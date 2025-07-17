const fs = require('fs');
const path = require('path');

// Simple script to convert SVG to PNG
// For actual use, you'll need to install a library like 'sharp' or use online converters

const svgToPng = (svgPath, pngPath, size) => {
  console.log(`To convert ${svgPath} to ${pngPath} at ${size}x${size}:`);
  console.log(`1. Open the SVG file in your browser or image editor`);
  console.log(`2. Take a screenshot or export as PNG at ${size}x${size} resolution`);
  console.log(`3. Save as ${pngPath}`);
  console.log('---');
};

const icons = [
  { svg: 'icons/icon16.svg', png: 'icons/icon16.png', size: 16 },
  { svg: 'icons/icon48.svg', png: 'icons/icon48.png', size: 48 },
  { svg: 'icons/icon128.svg', png: 'icons/icon128.png', size: 128 }
];

console.log('Chrome Extension Icon Conversion Guide');
console.log('=====================================\n');

icons.forEach(icon => {
  svgToPng(icon.svg, icon.png, icon.size);
});

console.log('Alternative: Use an online SVG to PNG converter:');
console.log('- https://convertio.co/svg-png/');
console.log('- https://cloudconvert.com/svg-to-png');
console.log('- https://www.svgviewer.dev/');

console.log('\nOnce you have PNG files, update manifest.json to use .png extensions');

// Check if SVG files exist
icons.forEach(icon => {
  if (fs.existsSync(icon.svg)) {
    console.log(`✓ ${icon.svg} exists`);
  } else {
    console.log(`✗ ${icon.svg} not found`);
  }
}); 