import {useEffect, useRef} from 'react';

import useConfiguration from './useConfiguration';

export function useSDKFeedbackButton() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const {SentrySDK} = useConfiguration();
  const feedback = SentrySDK && 'getFeedback' in SentrySDK && SentrySDK.getFeedback();

  useEffect(() => {
    if (feedback && buttonRef.current) {
      return feedback.attachTo(buttonRef.current, {});
    }
    return () => {};
  }, [feedback]);

  return feedback ? buttonRef : undefined;
}
