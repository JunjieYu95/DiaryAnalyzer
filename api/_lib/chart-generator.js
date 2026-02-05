/**
 * Server-side Chart Generator for Time Statistics
 * 
 * Uses QuickChart.io API to generate PNG chart images
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
 * Generate a time statistics chart as a base64 PNG image using QuickChart.io
 * @param {Object} stats - Statistics object with prod, nonprod, admin, dailyBreakdown
 * @param {string} periodLabel - Label for the time period (e.g., "This Week")
 * @param {string} chartType - Type of chart: "bar", "pie", or "doughnut"
 * @returns {Promise<string|null>} Base64-encoded PNG image, or null if generation fails
 */
export async function generateTimeStatsChart(stats, periodLabel, chartType = 'bar') {
  try {
    let chartConfig;
    
    if (chartType === 'bar') {
      chartConfig = createBarChartConfig(stats, periodLabel);
    } else if (chartType === 'pie' || chartType === 'doughnut') {
      chartConfig = createPieChartConfig(stats, periodLabel, chartType);
    } else {
      chartConfig = createBarChartConfig(stats, periodLabel);
    }

    // Use QuickChart.io API to generate the chart
    const quickChartUrl = 'https://quickchart.io/chart';
    
    const response = await fetch(quickChartUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chart: chartConfig,
        width: 800,
        height: chartType === 'bar' ? 450 : 500,
        backgroundColor: 'white',
        format: 'png',
      }),
    });

    if (!response.ok) {
      console.error('QuickChart API error:', response.status, response.statusText);
      return null;
    }

    // The response is binary PNG data - convert to base64
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
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
    a.date.localeCompare(b.date)
  );
  
  // Format labels to show day name and date clearly
  const labels = dailyData.map(d => d.displayDate || d.date);
  
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: CATEGORY_LABELS.prod,
          data: dailyData.map(d => Math.round(d.prod / 60 * 10) / 10),
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
      plugins: {
        title: {
          display: true,
          text: `Time Distribution - ${periodLabel}`,
          font: {
            size: 18,
            weight: 'bold',
          },
          padding: {
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
              size: 13,
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
            font: {
              size: 12,
              weight: 'bold',
            },
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: {
            display: true,
            text: 'Hours',
            font: {
              size: 13,
              weight: 'bold',
            },
          },
          ticks: {
            font: {
              size: 11,
            },
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
      plugins: {
        title: {
          display: true,
          text: `Time Distribution - ${periodLabel}`,
          font: {
            size: 18,
            weight: 'bold',
          },
          padding: {
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
              weight: 'bold',
            },
          },
        },
        datalabels: {
          display: true,
          color: '#fff',
          font: {
            weight: 'bold',
            size: 14,
          },
          formatter: (value, ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return percentage + '%';
          },
        },
      },
    },
  };
}

export default { generateTimeStatsChart };
