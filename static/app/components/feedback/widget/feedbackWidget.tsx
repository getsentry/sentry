import {getCurrentHub} from '@sentry/react';

import {FeedbackButton} from './feedbackButton';
import {FeedbackModal} from './feedbackModal';

interface FeedbackWidgetProps {
  title?: string;
  type?: string;
}

/**
 * The "Widget" connects the default Feedback button with the Feedback Modal
 *
 * XXX: this is temporary while we make this an SDK feature.
 */
export default function FeedbackWidget({
  title = 'Report a Bug',
  type,
}: FeedbackWidgetProps) {
  // Don't render anything if Sentry SDK is not already loaded
  if (!getCurrentHub()) {
    return null;
  }

  return (
    <FeedbackModal title={title} type={type}>
      {({open, showModal}) => (open ? null : <FeedbackButton onClick={showModal} />)}
    </FeedbackModal>
  );
}
