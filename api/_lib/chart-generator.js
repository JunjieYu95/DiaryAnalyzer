/**
 * Server-side Chart Generator for Time Statistics
 * 
 * Generates PNG chart images using Chart.js with @napi-rs/canvas
 * Returns base64-encoded image data for MCP responses
 */

// Chart colors
const COLORS = {
  prod: {
    background: 'rgba(16, 185, 129, 0.8)',    // Green
    border: 'rgb(16, 185, 129)',
  },
  nonprod: {
    background: 'rgba(107, 114, 128, 0.8)',   // Gray
    border: 'rgb(107, 114, 128)',
  },
  admin: {
    background: 'rgba(245, 158, 11, 0.8)',    // Orange/Amber
    border: 'rgb(245, 158, 11)',
  },
};

const CATEGORY_LABELS = {
  prod: 'Productive',
  nonprod: 'Non-productive',
  admin: 'Admin/Rest',
};

/**
 * Generate a time statistics chart as a base64 PNG image
 * @param {Object} stats - Statistics object with prod, nonprod, admin, dailyBreakdown
 * @param {string} periodLabel - Label for the time period (e.g., "This Week")
 * @param {string} chartType - Type of chart: "bar", "pie", or "doughnut"
 * @returns {Promise<string|null>} Base64-encoded PNG image, or null if generation fails
 */
export async function generateTimeStatsChart(stats, periodLabel, chartType = 'bar') {
  try {
    // Dynamic imports for serverless environment
    const { createCanvas, GlobalFonts } = await import('@napi-rs/canvas');
    const { Chart, registerables } = await import('chart.js');
    
    // Register all Chart.js components
    Chart.register(...registerables);
    
    // Set default font for Chart.js (use system fonts available in serverless)
    Chart.defaults.font.family = 'Arial, Helvetica, sans-serif';
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#374151';
    
    // Create canvas with larger size for better quality
    const width = 900;
    const height = chartType === 'bar' ? 500 : 550;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Fill background with white
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    
    let configuration;
    
    if (chartType === 'bar') {
      configuration = createBarChartConfig(stats, periodLabel);
    } else if (chartType === 'pie' || chartType === 'doughnut') {
      configuration = createPieChartConfig(stats, periodLabel, chartType);
    } else {
      configuration = createBarChartConfig(stats, periodLabel);
    }
    
    // Create chart
    new Chart(ctx, configuration);
    
    // Convert to PNG buffer and then base64
    const buffer = canvas.toBuffer('image/png');
    const base64 = buffer.toString('base64');
    
    return base64;
  } catch (err) {
    console.error('Error generating chart:', err);
    return null;
  }
}

/**
 * Create bar chart configuration for daily breakdown
 */
function createBarChartConfig(stats, periodLabel) {
  const dailyData = Object.values(stats.dailyBreakdown).sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  );
  
  // Format labels to show day name and date clearly
  const labels = dailyData.map(d => {
    const date = new Date(d.date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${dayName} ${monthDay}`;
  });
  
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: CATEGORY_LABELS.prod,
          data: dailyData.map(d => Math.round(d.prod / 60 * 10) / 10), // Convert to hours
          backgroundColor: COLORS.prod.background,
          borderColor: COLORS.prod.border,
          borderWidth: 2,
        },
        {
          label: CATEGORY_LABELS.admin,
          data: dailyData.map(d => Math.round(d.admin / 60 * 10) / 10),
          backgroundColor: COLORS.admin.background,
          borderColor: COLORS.admin.border,
          borderWidth: 2,
        },
        {
          label: CATEGORY_LABELS.nonprod,
          data: dailyData.map(d => Math.round(d.nonprod / 60 * 10) / 10),
          backgroundColor: COLORS.nonprod.background,
          borderColor: COLORS.nonprod.border,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      maintainAspectRatio: false,
      layout: {
        padding: {
          left: 20,
          right: 20,
          top: 20,
          bottom: 20,
        },
      },
      plugins: {
        title: {
          display: true,
          text: `Time Distribution - ${periodLabel}`,
          color: '#1f2937',
          font: {
            size: 20,
            weight: 'bold',
            family: 'Arial, Helvetica, sans-serif',
          },
          padding: {
            top: 10,
            bottom: 25,
          },
        },
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: '#374151',
            padding: 25,
            usePointStyle: true,
            pointStyle: 'rectRounded',
            font: {
              size: 14,
              family: 'Arial, Helvetica, sans-serif',
              weight: 'bold',
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: {
            display: false,
          },
          ticks: {
            color: '#374151',
            font: {
              size: 13,
              family: 'Arial, Helvetica, sans-serif',
              weight: 'bold',
            },
            maxRotation: 0,
            minRotation: 0,
          },
          border: {
            color: '#e5e7eb',
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: {
            display: true,
            text: 'Hours',
            color: '#374151',
            font: {
              size: 14,
              family: 'Arial, Helvetica, sans-serif',
              weight: 'bold',
            },
          },
          ticks: {
            color: '#374151',
            font: {
              size: 12,
              family: 'Arial, Helvetica, sans-serif',
            },
            callback: function(value) {
              return value + 'h';
            },
          },
          grid: {
            color: '#f3f4f6',
          },
          border: {
            color: '#e5e7eb',
          },
        },
      },
    },
  };
}

/**
 * Create pie/doughnut chart configuration for category totals
 */
function createPieChartConfig(stats, periodLabel, chartType) {
  const categories = ['prod', 'admin', 'nonprod'];
  const data = categories.map(cat => Math.round(stats[cat] / 60 * 10) / 10);
  const labels = categories.map(cat => CATEGORY_LABELS[cat]);
  const backgroundColors = categories.map(cat => COLORS[cat].background);
  const borderColors = categories.map(cat => COLORS[cat].border);
  
  // Filter out zero values and include hours in labels
  const filteredData = [];
  const filteredLabels = [];
  const filteredBgColors = [];
  const filteredBorderColors = [];
  
  for (let i = 0; i < data.length; i++) {
    if (data[i] > 0) {
      filteredData.push(data[i]);
      // Include hours in the label
      filteredLabels.push(`${labels[i]} (${data[i]}h)`);
      filteredBgColors.push(backgroundColors[i]);
      filteredBorderColors.push(borderColors[i]);
    }
  }
  
  return {
    type: chartType,
    data: {
      labels: filteredLabels,
      datasets: [{
        data: filteredData,
        backgroundColor: filteredBgColors,
        borderColor: filteredBorderColors,
        borderWidth: 3,
      }],
    },
    options: {
      responsive: false,
      animation: false,
      maintainAspectRatio: false,
      layout: {
        padding: {
          left: 20,
          right: 20,
          top: 20,
          bottom: 20,
        },
      },
      plugins: {
        title: {
          display: true,
          text: `Time Distribution - ${periodLabel}`,
          color: '#1f2937',
          font: {
            size: 20,
            weight: 'bold',
            family: 'Arial, Helvetica, sans-serif',
          },
          padding: {
            top: 10,
            bottom: 25,
          },
        },
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: '#374151',
            padding: 25,
            usePointStyle: true,
            pointStyle: 'circle',
            font: {
              size: 14,
              family: 'Arial, Helvetica, sans-serif',
              weight: 'bold',
            },
          },
        },
      },
    },
  };
}

export default { generateTimeStatsChart };
