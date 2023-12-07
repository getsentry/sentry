import {css, Global} from '@emotion/react';

import useFeedbackWidget from 'sentry/components/feedback/widget/useFeedbackWidget';
import theme from 'sentry/utils/theme';

/**
 * Use this to display the Feedback widget in certain routes/components
 */
export default function FloatingFeedbackWidget() {
  const feedback = useFeedbackWidget({});

  // No need for global styles if Feedback integration is not enabled
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
