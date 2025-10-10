import {Alert} from '@sentry/scraps/alert';

import {t} from 'sentry/locale';

export default function ReplayRequestsThrottledAlert() {
  return (
    <Alert.Container>
      <Alert type="info" data-test-id="replay-throttled">
        {t(
          'API requests have been temporarily rate-limited. Please wait a moment and try again.'
        )}
      </Alert>
    </Alert.Container>
  );
}
