// Reexport the native module (mã Swift/Kotlin)
export { default } from './ValtecTtsModule';
export { default as ValtecTtsView } from './ValtecTtsView';
export * from './ValtecTts.types';

// Export thêm TTSEngine để người dùng có thể khởi tạo
export { ValtecTTSEngine } from './hook/ValtecTTSEngine';
export { VietnameseG2P } from './hook/vietnamese_g2p';
export * from './hook/textChunker';