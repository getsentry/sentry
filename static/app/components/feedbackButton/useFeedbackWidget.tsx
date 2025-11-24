import type {RefObject} from 'react';
import {useEffect} from 'react';

import {useFeedbackSDKIntegration} from 'sentry/components/feedbackButton/useFeedbackSDKIntegration';

interface Props {
  buttonRef?: RefObject<HTMLButtonElement | null> | RefObject<HTMLAnchorElement | null>;
}

/**
 * @deprecated This layer isn't needed. Call `useFeedbackSDKIntegration` or use `<FeedbackButton/>` or `<FloatingFeedbackButton/>`
 */
export default function useFeedbackWidget({buttonRef}: Props) {
  const {feedback, defaultOptions} = useFeedbackSDKIntegration();

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    if (buttonRef) {
      if (buttonRef.current) {
        return feedback.attachTo(buttonRef.current, defaultOptions);
      }
    } else {
      const widget = feedback.createWidget(defaultOptions);
      return () => {
        widget.removeFromDom();
      };
    }

    return undefined;
  }, [buttonRef, feedback, defaultOptions]);

  return feedback;
}
