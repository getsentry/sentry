import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import PlatformList from 'app/components/platformList';

storiesOf('UI|Platform List', module).add(
  'Platform List',
  withInfo('Stacked list of platform and framework icons')(() => (
    <div style={{padding: 20, backgroundColor: '#ffffff'}}>
      <PlatformList platforms={['java', 'php', 'javascript', 'cocoa', 'ruby']} />
    </div>
  ))
);
