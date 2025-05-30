import {Alert} from 'sentry/components/core/alert';
import {t} from 'sentry/locale';

export default function ReplayRequestsThrottledAlert() {
  return (
    <Alert.Container>
      <Alert type="info" showIcon data-test-id="replay-throttled">
        {t(
          "You're sending too many requests in a short period and have been temporarily rate-limited. Please wait a moment and try again."
        )}
      </Alert>
    </Alert.Container>
  );
}
