import ClipboardTooltip from 'sentry/components/clipboardTooltip';

export default {
  title: 'Components/Tooltips/Clipboard Tooltip',
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

_ClipboardTooltip.storyName = 'Clipboard Tooltip';
_ClipboardTooltip.parameters = {
  docs: {
    description: {
      story: 'Displays a hoverable tooltip with a copy icon.',
    },
  },
};
