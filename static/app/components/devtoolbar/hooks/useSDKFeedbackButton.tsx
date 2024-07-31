import {useEffect, useRef} from 'react';

import useConfiguration from './useConfiguration';

export function useSDKFeedbackButton({
  onFormClose,
  onFormOpen,
}: {
  onFormClose?: () => void;
  onFormOpen?: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const {SentrySDK} = useConfiguration();
  const feedback = SentrySDK && 'getFeedback' in SentrySDK && SentrySDK.getFeedback();

  useEffect(() => {
    if (feedback && buttonRef.current) {
      return feedback.attachTo(buttonRef.current, {onFormOpen, onFormClose});
    }
    return () => {};
  }, [feedback, onFormOpen, onFormClose]);

  return feedback ? buttonRef : undefined;
}
