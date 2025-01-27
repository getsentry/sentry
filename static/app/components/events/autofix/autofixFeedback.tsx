import {useRef} from 'react';

import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';

function AutofixFeedback() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const openForm = useFeedbackForm();

  if (!openForm) {
    return null;
  }

  return (
    <Button
      ref={buttonRef}
      size="xs"
      onClick={() =>
        openForm({
          messagePlaceholder: t('How can we make Autofix better for you?'),
          tags: {
            ['feedback.source']: 'issue_details_ai_autofix',
            ['feedback.owner']: 'ml-ai',
          },
        })
      }
    >
      {t('Give Feedback')}
    </Button>
  );
}

export default AutofixFeedback;
