import {useEffect, useRef} from 'react';

import {Button} from 'sentry/components/button';
import {useFeedback} from 'sentry/components/feedback/widget/useFeedback';
import {IconMegaphone} from 'sentry/icons/iconMegaphone';
import {t} from 'sentry/locale';
import ModalStore from 'sentry/stores/modalStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

export default function FeedbackPauseFocusButton() {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const {pauseFocusTrap, unpauseFocusTrap} = useLegacyStore(ModalStore);

  const {feedback, options} = useFeedback({});
  useEffect(() => {
    if (feedback && buttonRef && buttonRef.current) {
      return feedback.attachTo(buttonRef.current, {
        ...options,
        onFormOpen: () => {
          pauseFocusTrap ? pauseFocusTrap() : null;
        },
        onFormClose: () => {
          unpauseFocusTrap ? unpauseFocusTrap() : null;
        },
      });
    }
    return undefined;
  }, [buttonRef, feedback, options, pauseFocusTrap, unpauseFocusTrap]);

  return feedback && pauseFocusTrap && unpauseFocusTrap ? (
    <Button ref={buttonRef} size="sm" icon={<IconMegaphone />}>
      {t('Give Feedback')}
    </Button>
  ) : null;
}
