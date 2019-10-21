import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import getDynamicText from 'app/utils/getDynamicText';

storiesOf('Utility|getDynamicText', module).add(
  'getDynamicText',
  withInfo(
    `
    Use this to wrap dynamic content (i.e. dates) for acceptance/snapshot tests.
    Currently checks for existence of PERCY_TOKEN env var.
    (storybook webpack config has webpack.DefinePlugin for "process.env.IS_PERCY")
    `
  )(() => {
    return (
      <React.Fragment>
        {getDynamicText({
          fixed: 'Fixed Content',
          value: 'Pretend this is a dynamic value',
        })}
      </React.Fragment>
    );
  })
);
