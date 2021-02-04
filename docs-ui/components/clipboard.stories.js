import React from 'react';

import Clipboard from 'app/components/clipboard';

export default {
  title: 'UI/Clipboard',
  component: Clipboard,
  args: {
    value: 'This will be copied to clipboard',
  },
  argTypes: {
    onSuccess: {action: 'Copied to clipboard'},
    onError: {action: 'Failed copy to clipboard'},
  },
};

export const Default = ({...args}) => (
  <Clipboard {...args}>
    <span priority="primary">Click to Copy</span>
  </Clipboard>
);

Default.storyName = 'Clipboard';
Default.parameters = {
  docs: {
    description: {
      story: 'Copy text to clipboard',
    },
  },
};
