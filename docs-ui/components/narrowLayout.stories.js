import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import NarrowLayout from 'app/components/narrowLayout';

storiesOf('NarrowLayout', module).add(
  'default',
  withInfo('A narrow layout')(() => <NarrowLayout>Narrow Layout</NarrowLayout>)
);
