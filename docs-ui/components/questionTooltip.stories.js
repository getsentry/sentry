import React from 'react';

import QuestionTooltip from 'app/components/questionTooltip';
import theme from 'app/utils/theme';

export default {
  title: 'Core/Tooltips/QuestionTooltip',
  component: QuestionTooltip,
  args: {
    title: 'tooltip',
    size: theme.iconSizes.sm,
  },
  argTypes: {
    size: {
      control: {
        type: 'select',
        options: theme.iconSizes,
      },
    },
  },
};

export const _QuestionTooltip = ({...args}) => {
  return (
    <React.Fragment>
      <h3>
        Some Jargon Term
        <QuestionTooltip {...args} />
      </h3>
    </React.Fragment>
  );
};

_QuestionTooltip.storyName = 'QuestionTooltip';
_QuestionTooltip.parameters = {
  docs: {
    description: {
      story:
        'Show a question mark icon with a tooltip to provide in context help information.',
    },
  },
};
