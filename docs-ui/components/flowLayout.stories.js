import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
// import {action} from '@storybook/addon-actions';

import FlowLayout from 'sentry-ui/flowLayout';

storiesOf('ComponentLayouts/FlowLayout', module).add(
  'default',
  withInfo('Horizontal row with vertical centering')(() => (
    <FlowLayout style={{backgroundColor: '#fff'}}>
      <div style={{padding: 6, backgroundColor: 'rgba(0, 0, 0, 0.2)'}}>
        Flow
      </div>
      <div style={{padding: 12, backgroundColor: 'rgba(0, 0, 0, 0.1)'}}>
        Layout
      </div>
      <div style={{padding: 24, backgroundColor: 'rgba(0, 0, 0, 0.05)'}}>
        Flow
      </div>
      <div style={{padding: 18, backgroundColor: 'rgba(0, 0, 0, 0.3)'}}>
        Layout
      </div>
    </FlowLayout>
  ))
);
