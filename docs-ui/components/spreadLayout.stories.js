import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
// import {action} from '@storybook/addon-actions';

import SpreadLayout from 'sentry-ui/spreadLayout';

storiesOf('ComponentLayouts/SpreadLayout', module).add(
  'default',
  withInfo('Children elements get spread out (flexbox space-between)')(() => (
    <SpreadLayout style={{backgroundColor: '#fff'}}>
      <div style={{padding: 6, backgroundColor: 'rgba(0, 0, 0, 0.2)'}}>
        Spread
      </div>
      <div style={{padding: 12, backgroundColor: 'rgba(0, 0, 0, 0.1)'}}>
        Layout
      </div>
    </SpreadLayout>
  ))
);
