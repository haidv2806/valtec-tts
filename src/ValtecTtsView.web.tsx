import * as React from 'react';

import { ValtecTtsViewProps } from './ValtecTts.types';

export default function ValtecTtsView(props: ValtecTtsViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
