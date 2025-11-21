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
  const {feedback, options} = useFeedbackSDKIntegration();

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    if (buttonRef) {
      if (buttonRef.current) {
        return feedback.attachTo(buttonRef.current, options);
      }
    } else {
      const widget = feedback.createWidget(options);
      return () => {
        widget.removeFromDom();
      };
    }

    return undefined;
  }, [buttonRef, feedback, options]);

  return feedback;
}
