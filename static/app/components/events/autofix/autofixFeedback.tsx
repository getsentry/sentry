import {useRef} from 'react';

import {Button} from 'sentry/components/core/button';
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
          formTitle: t('Give feedback to the devs'),
          messagePlaceholder: t('How can we make Seer better for you?'),
          tags: {
            ['feedback.source']: 'issue_details_ai_autofix',
            ['feedback.owner']: 'ml-ai',
          },
        })
      }
    >
      {t('Give Us Feedback')}
    </Button>
  );
}

export default AutofixFeedback;
