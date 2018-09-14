import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import SplitLayout from 'app/components/splitLayout';

storiesOf('Deprecated|ComponentLayouts/SplitLayout', module).add(
  'default',
  withInfo('Children elements have equal size')(() => (
    <SplitLayout splitWidth={15} style={{backgroundColor: '#fff'}}>
      <div style={{padding: 6, backgroundColor: 'rgba(0, 0, 0, 0.2)'}}>Split</div>
      <div style={{padding: 12, backgroundColor: 'rgba(0, 0, 0, 0.1)'}}>Layout</div>
    </SplitLayout>
  ))
);
