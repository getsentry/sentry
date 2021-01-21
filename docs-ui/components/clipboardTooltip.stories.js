import React from 'react';
import {withInfo} from '@storybook/addon-info';
import {text} from '@storybook/addon-knobs';

import ClipboardTooltip from 'app/components/clipboardTooltip';

export default {
  title: 'Core/Tooltips/ClipboardTooltip',
};

export const _ClipboardTooltip = withInfo(
  'Displays a hoverable tooltip with a copy icon.'
)(() => (
  <ClipboardTooltip title={text('tooltip', 'Tooltip content')}>
    This text displays a tooltip when hovering
  </ClipboardTooltip>
));

_ClipboardTooltip.story = {
  name: 'ClipboardTooltip',
};
