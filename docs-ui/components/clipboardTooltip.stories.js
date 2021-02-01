import React from 'react';

import ClipboardTooltip from 'app/components/clipboardTooltip';

export default {
  title: 'Core/Tooltips/ClipboardTooltip',
  component: 'ClipboardTooltip',
  args: {
    title: 'Tooltip content',
  },
};

export const _ClipboardTooltip = ({...args}) => (
  <ClipboardTooltip {...args}>
    This text displays a tooltip when hovering
  </ClipboardTooltip>
);

_ClipboardTooltip.storyName = 'ClipboardTooltip';
_ClipboardTooltip.parameters = {
  docs: {
    description: {
      story: 'Displays a hoverable tooltip with a copy icon.',
    },
  },
};
