import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import SpreadLayout from 'app/components/spreadLayout';

storiesOf('Deprecated|ComponentLayouts/SpreadLayout', module)
  .add(
    'default',
    withInfo('Children elements get spread out (flexbox space-between)')(() => (
      <SpreadLayout style={{backgroundColor: '#fff'}}>
        <div style={{padding: 6, backgroundColor: 'rgba(0, 0, 0, 0.2)'}}>Spread</div>
        <div style={{padding: 12, backgroundColor: 'rgba(0, 0, 0, 0.1)'}}>Layout</div>
      </SpreadLayout>
    ))
  )
  .add(
    'no center',
    withInfo('Children elements get spread out (flexbox space-between)')(() => (
      <SpreadLayout center={false} style={{backgroundColor: '#fff'}}>
        <div style={{padding: 6, backgroundColor: 'rgba(0, 0, 0, 0.2)'}}>Spread</div>
        <div style={{padding: 12, backgroundColor: 'rgba(0, 0, 0, 0.1)'}}>Layout</div>
      </SpreadLayout>
    ))
  );
