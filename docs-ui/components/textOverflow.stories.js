import React from 'react';

import TextOverflow from 'app/components/textOverflow';

export default {
  title: 'Core/Style/Text',
  args: {
    isParagraph: false,
    ellipsisDirection: 'right',
  },
  argTypes: {
    ellipsisDirection: {
      control: {
        type: 'select',
        options: ['left', 'right'],
      },
    },
  },
};

export const _TextOverflow = ({...args}) => (
  <div style={{width: 50}}>
    <TextOverflow {...args}>AReallyLongTextString</TextOverflow>
  </div>
);

_TextOverflow.storyName = 'TextOverflow';
_TextOverflow.parameters = {
  docs: {
    description: {
      story:
        'Simple component that adds "text-overflow: ellipsis" and "overflow: hidden", still depends on container styles',
    },
  },
};
