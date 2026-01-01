import { NativeModule, requireNativeModule } from 'expo';

import { ValtecTtsModuleEvents } from './ValtecTts.types';

declare class ValtecTtsModule extends NativeModule<ValtecTtsModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ValtecTtsModule>('ValtecTts');
