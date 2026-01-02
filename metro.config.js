const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Thêm đuôi file .onnx vào danh sách các asset được phép nhận diện
config.resolver.assetExts.push('onnx');

module.exports = config;