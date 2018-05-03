import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import DynamicWrapper from 'app/components/dynamicWrapper';

storiesOf('DynamicWrapper', module).add(
  'default',
  withInfo(
    `
    Use this to wrap dynamic content (i.e. dates) for acceptance/snapshot tests.
    Currently checks for existance of PERCY_TOKEN env var.
    (storybook webpack config has webpack.DefinePlugin for "process.env.IS_PERCY")
    `
  )(() => {
    return (
      <DynamicWrapper fixed="Fixed Content" value="Pretend this is a dynamic value" />
    );
  })
);
