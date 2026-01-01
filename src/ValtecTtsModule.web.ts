import { registerWebModule, NativeModule } from 'expo';

import { ValtecTtsModuleEvents } from './ValtecTts.types';

class ValtecTtsModule extends NativeModule<ValtecTtsModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(ValtecTtsModule, 'ValtecTtsModule');
