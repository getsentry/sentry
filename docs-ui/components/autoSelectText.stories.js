import React from 'react';
import {withInfo} from '@storybook/addon-info';

import AutoSelectText from 'app/components/autoSelectText';

export default {
  title: 'Utilities/AutoSelectText',
};

export const Default = withInfo('Select text on click')(() => (
  <div>
    <AutoSelectText>Click to highlight text</AutoSelectText>
  </div>
));

Default.story = {
  name: 'default',
};
