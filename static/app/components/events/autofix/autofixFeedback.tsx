import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';

interface AutofixFeedbackProps {
  iconOnly?: boolean;
}

export default function AutofixFeedback(
  {iconOnly = false}: AutofixFeedbackProps = {iconOnly: false}
) {
  const buttonProps = {
    size: 'xs' as const,
    feedbackOptions: {
      formTitle: t('Give feedback to the devs'),
      messagePlaceholder: t('How can we make Seer better for you?'),
      tags: {
        ['feedback.source']: 'issue_details_ai_autofix',
        ['feedback.owner']: 'ml-ai',
      },
    },
    title: iconOnly ? t('Give feedback to the devs') : undefined,
    ...(iconOnly && {children: null}),
  };

  return <FeedbackButton {...buttonProps} />;
}
