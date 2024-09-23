import {useRef} from 'react';

import {Button} from 'sentry/components/button';
import useFeedbackWidget from 'sentry/components/feedback/widget/useFeedbackWidget';
import {IconMegaphone} from 'sentry/icons/iconMegaphone';
import {t} from 'sentry/locale';

function AutofixFeedback() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const feedback = useFeedbackWidget({
    buttonRef,
    messagePlaceholder: t('How can we make Autofix better for you?'),
    optionOverrides: {
      tags: {
        ['feedback.source']: 'issue_details_ai_autofix',
        ['feedback.owner']: 'ml-ai',
      },
    },
  });

  if (!feedback) {
    return null;
  }

  return (
    <Button ref={buttonRef} size="xs" icon={<IconMegaphone />}>
      {t('Give Feedback')}
    </Button>
  );
}

export default AutofixFeedback;
