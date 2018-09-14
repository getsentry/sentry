import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import Toolbar from 'app/components/toolbar';
import ToolbarHeader from 'app/components/toolbarHeader';
import SpreadLayout from 'app/components/spreadLayout';

storiesOf('Deprecated|Toolbar', module).add(
  'default',
  withInfo(
    'Toolbar that is used on top of a box. i.e. Issue Stream. Not responsible for any layout/padding.'
  )(() => (
    <Toolbar>
      <SpreadLayout>
        <ToolbarHeader>Left</ToolbarHeader>
        <ToolbarHeader>Right</ToolbarHeader>
      </SpreadLayout>
    </Toolbar>
  ))
);
