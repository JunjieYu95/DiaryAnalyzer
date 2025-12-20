// Supabase Edge Function: Google OAuth Token Exchange and Refresh
// This function handles:
// 1. Exchanging authorization codes for access + refresh tokens
// 2. Refreshing expired access tokens using stored refresh tokens

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Google OAuth endpoints
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface ExchangeRequest {
  action: "exchange" | "refresh";
  code?: string;           // For exchange action
  redirect_uri?: string;   // For exchange action
  user_id?: string;        // For refresh action
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error("Google OAuth credentials not configured");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    // Initialize Supabase client with service role (to access user_tokens table)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request body
    const body: ExchangeRequest = await req.json();
    console.log("Request action:", body.action);

    if (body.action === "exchange") {
      // ========================================
      // EXCHANGE: Auth code -> Access + Refresh tokens
      // ========================================
      
      if (!body.code || !body.redirect_uri) {
        throw new Error("Missing code or redirect_uri for exchange");
      }

      console.log("Exchanging auth code for tokens...");

      // Exchange authorization code for tokens
      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code: body.code,
          redirect_uri: body.redirect_uri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error("Token exchange failed:", error);
        throw new Error(`Token exchange failed: ${error}`);
      }

      const tokens: TokenResponse = await tokenResponse.json();
      console.log("Got tokens, expires_in:", tokens.expires_in);

      // Get user info from Google to identify the user
      const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        throw new Error("Failed to get user info from Google");
      }

      const userInfo = await userInfoResponse.json();
      console.log("User email:", userInfo.email);

      // Calculate token expiration time
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Store tokens in database (upsert based on google_email)
      const { data: tokenData, error: dbError } = await supabase
        .from("user_tokens")
        .upsert({
          google_email: userInfo.email,
          google_user_id: userInfo.id,
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token || null,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "google_email",
        })
        .select()
        .single();

      if (dbError) {
        console.error("Database error:", dbError);
        throw new Error(`Failed to store tokens: ${dbError.message}`);
      }

      console.log("Tokens stored successfully for user:", userInfo.email);

      // Return the access token and user info to frontend
      return new Response(
        JSON.stringify({
          success: true,
          access_token: tokens.access_token,
          expires_in: tokens.expires_in,
          expires_at: expiresAt,
          user: {
            id: tokenData.id,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
          },
          has_refresh_token: !!tokens.refresh_token,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );

    } else if (body.action === "refresh") {
      // ========================================
      // REFRESH: Use stored refresh token to get new access token
      // ========================================
      
      if (!body.user_id) {
        throw new Error("Missing user_id for refresh");
      }

      console.log("Refreshing token for user:", body.user_id);

      // Get stored refresh token from database
      const { data: userData, error: fetchError } = await supabase
        .from("user_tokens")
        .select("*")
        .eq("id", body.user_id)
        .single();

      if (fetchError || !userData) {
        console.error("User not found:", fetchError);
        throw new Error("User not found or no stored tokens");
      }

      if (!userData.google_refresh_token) {
        throw new Error("No refresh token stored for this user. Please sign in again.");
      }

      console.log("Found refresh token, requesting new access token...");

      // Use refresh token to get new access token
      const refreshResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: userData.google_refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (!refreshResponse.ok) {
        const error = await refreshResponse.text();
        console.error("Token refresh failed:", error);
        
        // If refresh token is invalid, user needs to re-authenticate
        if (error.includes("invalid_grant")) {
          // Clear the invalid refresh token
          await supabase
            .from("user_tokens")
            .update({ google_refresh_token: null })
            .eq("id", body.user_id);
          
          throw new Error("Refresh token expired or revoked. Please sign in again.");
        }
        
        throw new Error(`Token refresh failed: ${error}`);
      }

      const newTokens: TokenResponse = await refreshResponse.json();
      console.log("Got new access token, expires_in:", newTokens.expires_in);

      // Calculate new expiration time
      const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

      // Update stored access token
      const { error: updateError } = await supabase
        .from("user_tokens")
        .update({
          google_access_token: newTokens.access_token,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.user_id);

      if (updateError) {
        console.error("Failed to update token:", updateError);
        throw new Error(`Failed to update token: ${updateError.message}`);
      }

      console.log("Token refreshed successfully");

      return new Response(
        JSON.stringify({
          success: true,
          access_token: newTokens.access_token,
          expires_in: newTokens.expires_in,
          expires_at: expiresAt,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );

    } else {
      throw new Error(`Unknown action: ${body.action}`);
    }

  } catch (error) {
    console.error("Error:", error.message);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
