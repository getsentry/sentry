import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import PlatformList from 'app/components/platformList';

storiesOf('Platform List', module).add(
  'default',
  withInfo('Stacked list of platform and framework icons')(() => (
    <div style={{padding: 20, backgroundColor: '#ffffff'}}>
      <PlatformList platforms={['java', 'php', 'javascript', 'cocoa', 'ruby']} />
    </div>
  ))
);
