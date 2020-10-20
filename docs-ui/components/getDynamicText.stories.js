import React from 'react';
import {withInfo} from '@storybook/addon-info';

import getDynamicText from 'app/utils/getDynamicText';

export default {
  title: 'Utilities/getDynamicText',
};

export const GetDynamicText = withInfo(
  `
  Use this to wrap dynamic content (i.e. dates) for acceptance/snapshot tests.
  Currently checks for IS_ACCEPTANCE_TEST env var.
  (webpack config has webpack.DefinePlugin for "process.env.IS_ACCEPTANCE_TEST")
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
});

GetDynamicText.story = {
  name: 'getDynamicText',
};
