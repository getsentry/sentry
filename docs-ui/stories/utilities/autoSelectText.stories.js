import React from 'react';

import AutoSelectText from 'app/components/autoSelectText';

export default {
  title: 'Utilities/Text/Auto Select',
  component: AutoSelectText,
};

export const Default = () => <AutoSelectText>Click to highlight text</AutoSelectText>;
Default.storyName = 'Auto Select';
Default.parameters = {
  docs: {
    description: {
      story: 'Select text on click',
    },
  },
};
