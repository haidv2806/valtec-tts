import ValtecTTSEngine from './hook/ValtecTTSEngine';
// Reexport the native module (mã Swift/Kotlin)
// export { default } from './ValtecTtsModule';
// export { default as ValtecTtsView } from './ValtecTtsView';
// export * from './ValtecTts.types';

// Export thêm TTSEngine để người dùng có thể khởi tạo
export default ValtecTTSEngine
export * from './hook/textChunker';