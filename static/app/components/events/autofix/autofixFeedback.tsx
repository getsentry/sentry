import {type ComponentProps} from 'react';

import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';

interface AutofixFeedbackProps extends ComponentProps<typeof FeedbackButton> {
  iconOnly?: boolean;
}

export default function AutofixFeedback({
  children,
  iconOnly = false,
  ...buttonProps
}: AutofixFeedbackProps) {
  return (
    <FeedbackButton
      size="xs"
      feedbackOptions={{
        formTitle: t('Give feedback to the devs'),
        messagePlaceholder: t('How can we make Seer better for you?'),
        tags: {
          ['feedback.source']: 'issue_details_ai_autofix',
          ['feedback.owner']: 'ml-ai',
        },
      }}
      tooltipProps={{title: t('Give feedback to the devs')}}
      {...buttonProps}
    >
      {iconOnly ? null : children}
    </FeedbackButton>
  );
}
