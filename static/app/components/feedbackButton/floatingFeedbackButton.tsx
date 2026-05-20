import {useEffect} from 'react';

import {useFeedbackSDKIntegration} from 'sentry/components/feedbackButton/useFeedbackSDKIntegration';

/**
 * `<FloatingFeedbackButton /> renders a 'Give Feedback' button that floats in
 * the bottom right corner of the page.
 *
 * This button can float overtop of content, but can also be helpful because it
 * allows users to scroll anywhere and still be able to trigger the Feedback form
 * which allows taking screenshots of what's visible on the page.
 */
export function FloatingFeedbackButton() {
  const {feedback, defaultOptions} = useFeedbackSDKIntegration();

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const widget = feedback.createWidget(defaultOptions);
    return () => {
      widget.removeFromDom();
    };
  }, [feedback, defaultOptions]);

  if (!feedback) {
    return null;
  }

  return null;
}
