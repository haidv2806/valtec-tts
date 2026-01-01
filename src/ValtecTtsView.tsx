import { requireNativeView } from 'expo';
import * as React from 'react';

import { ValtecTtsViewProps } from './ValtecTts.types';

const NativeView: React.ComponentType<ValtecTtsViewProps> =
  requireNativeView('ValtecTts');

export default function ValtecTtsView(props: ValtecTtsViewProps) {
  return <NativeView {...props} />;
}
