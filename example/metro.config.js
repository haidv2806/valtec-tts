// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// 1. Tránh xung đột React Native giữa thư mục gốc và example
config.resolver.blockList = [
  ...Array.from(config.resolver.blockList ?? []),
  new RegExp(path.resolve('..', 'node_modules', 'react')),
  new RegExp(path.resolve('..', 'node_modules', 'react-native')),
];

// 2. Định nghĩa các đường dẫn tìm kiếm Module
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, './node_modules'),
  path.resolve(__dirname, '../node_modules'),
];

// 3. Cấu hình Alias (extraNodeModules)
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'valtec-tts': path.resolve(__dirname, '..'), // Trỏ về thư mục gốc của library
  '@valtectts-models': path.resolve(__dirname, '../model'), // Alias cho thư mục model
};

config.resolver.assetExts.push('onnx');


// 6. Theo dõi thay đổi ở thư mục cha (library source)
config.watchFolders = [path.resolve(__dirname, '..')];

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;

