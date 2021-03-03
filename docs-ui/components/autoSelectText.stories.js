import React from 'react';

import AutoSelectText from 'app/components/autoSelectText';

export default {
  title: 'Utilities/AutoSelectText',
  component: AutoSelectText,
};

export const Default = () => <AutoSelectText>Click to highlight text</AutoSelectText>;
Default.storyName = 'AutoSelectText';
Default.parameters = {
  docs: {
    description: {
      story: 'Select text on click',
    },
  },
};
