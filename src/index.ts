// Reexport the native module. On web, it will be resolved to ValtecTtsModule.web.ts
// and on native platforms to ValtecTtsModule.ts
export { default } from './ValtecTtsModule';
export { default as ValtecTtsView } from './ValtecTtsView';
export * from  './ValtecTts.types';
