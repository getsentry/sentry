import {Fragment} from 'react';

import QuestionTooltip from 'sentry/components/questionTooltip';
import theme from 'sentry/utils/theme';

export default {
  title: 'Components/Tooltips/Question Tooltip',
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
    <Fragment>
      <h3>
        Some Jargon Term
        <QuestionTooltip {...args} />
      </h3>
    </Fragment>
  );
};

_QuestionTooltip.storyName = 'Question Tooltip';
_QuestionTooltip.parameters = {
  docs: {
    description: {
      story:
        'Show a question mark icon with a tooltip to provide in context help information.',
    },
  },
};
