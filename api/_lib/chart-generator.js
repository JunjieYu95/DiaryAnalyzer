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
    const { createCanvas } = await import('@napi-rs/canvas');
    const { Chart, registerables } = await import('chart.js');
    
    // Register all Chart.js components
    Chart.register(...registerables);
    
    // Create canvas
    const width = 800;
    const height = chartType === 'bar' ? 400 : 500;
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
  
  const labels = dailyData.map(d => d.displayDate);
  
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
          borderWidth: 1,
        },
        {
          label: CATEGORY_LABELS.admin,
          data: dailyData.map(d => Math.round(d.admin / 60 * 10) / 10),
          backgroundColor: COLORS.admin.background,
          borderColor: COLORS.admin.border,
          borderWidth: 1,
        },
        {
          label: CATEGORY_LABELS.nonprod,
          data: dailyData.map(d => Math.round(d.nonprod / 60 * 10) / 10),
          backgroundColor: COLORS.nonprod.background,
          borderColor: COLORS.nonprod.border,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        title: {
          display: true,
          text: `Time Distribution - ${periodLabel}`,
          font: {
            size: 18,
            weight: 'bold',
          },
          padding: {
            top: 10,
            bottom: 20,
          },
        },
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            padding: 20,
            usePointStyle: true,
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: {
            display: false,
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: {
            display: true,
            text: 'Hours',
            font: {
              size: 14,
            },
          },
          ticks: {
            callback: function(value) {
              return value + 'h';
            },
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
  
  // Filter out zero values
  const filteredData = [];
  const filteredLabels = [];
  const filteredBgColors = [];
  const filteredBorderColors = [];
  
  for (let i = 0; i < data.length; i++) {
    if (data[i] > 0) {
      filteredData.push(data[i]);
      filteredLabels.push(labels[i]);
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
        borderWidth: 2,
      }],
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        title: {
          display: true,
          text: `Time Distribution - ${periodLabel}`,
          font: {
            size: 18,
            weight: 'bold',
          },
          padding: {
            top: 10,
            bottom: 20,
          },
        },
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            padding: 20,
            usePointStyle: true,
            font: {
              size: 14,
            },
          },
        },
      },
    },
  };
}

export default { generateTimeStatsChart };
