import {getCurrentHub} from '@sentry/react';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

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
  const config = useLegacyStore(ConfigStore);

  // Don't render anything if Sentry SDK is not already loaded
  if (!getCurrentHub()) {
    return null;
  }

  const widgetTheme = config.theme === 'dark' ? 'dark' : 'light';
  return (
    <FeedbackModal title={title} type={type} widgetTheme={widgetTheme}>
      {({open, showModal}) =>
        open ? null : <FeedbackButton onClick={showModal} widgetTheme={widgetTheme} />
      }
    </FeedbackModal>
  );
}
