import React from 'react';
import {withInfo} from '@storybook/addon-info';
import {text, select} from '@storybook/addon-knobs';

import QuestionTooltip from 'app/components/questionTooltip';
import theme from 'app/utils/theme';

export default {
  title: 'Core/Tooltips/QuestionTooltip',
};

export const _QuestionTooltip = withInfo({
  text:
    'Show a question mark icon with a tooltip to provide in context help information.',
})(() => {
  const title = text('tooltip', 'This is a neat word that needs some help');
  const displayMode = select('Container display mode', [
    'block',
    'inline-block',
    'inline',
  ]);
  const position = select(
    'position',
    {top: 'top', bottom: 'bottom', left: 'left', right: 'right'},
    'top'
  );
  const size = select('size', theme.iconSizes, theme.iconSizes.sm);

  return (
    <React.Fragment>
      <h3>
        Some Jargon Term
        <QuestionTooltip
          title={title}
          position={position}
          size={size}
          containerDisplayMode={displayMode}
        />
      </h3>
    </React.Fragment>
  );
});

_QuestionTooltip.story = {
  name: 'QuestionTooltip',
};
