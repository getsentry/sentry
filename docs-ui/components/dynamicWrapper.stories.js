import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import DynamicWrapper from 'sentry-ui/dynamicWrapper';

storiesOf('DynamicWrapper', module).add(
  'default',
  withInfo(
    'Use this to wrap dynamic content (i.e. dates) for acceptance/snapshot tests. Currently checks for existance of PERCY_TOKEN env var'
  )(() => <DynamicWrapper fixed="Fixed Content" value={new Date().toString()} />)
);
