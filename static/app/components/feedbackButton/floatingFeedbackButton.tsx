import {useEffect} from 'react';
import {css, Global, useTheme} from '@emotion/react';

import {useFeedbackSDKIntegration} from 'sentry/components/feedbackButton/useFeedbackSDKIntegration';

/**
 * `<FloatingFeedbackButton /> renders a 'Give Feedback' button that floats in
 * the bottom right corner of the page.
 *
 * This button can float overtop of content, but can also be helpful because it
 * allows users to scroll anywhere and still be able to trigger the Feedback form
 * which allows taking screenshots of what's visible on the page.
 */
export default function FloatingFeedbackButton() {
  const theme = useTheme();
  const {feedback, defaultOptions} = useFeedbackSDKIntegration();

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const widget = feedback.createWidget(defaultOptions);
    return () => {
      widget.removeFromDom();
    };
  }, [feedback, defaultOptions]);

  if (!feedback) {
    return null;
  }

  // z-index needs to be below our indicators which is 10001
  return (
    <Global
      styles={css`
        #sentry-feedback {
          --z-index: ${theme.zIndex.toast - 1};
        }
      `}
    />
  );
}
