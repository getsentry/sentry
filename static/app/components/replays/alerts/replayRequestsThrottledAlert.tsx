import {Alert} from 'sentry/components/core/alert';
import {t} from 'sentry/locale';

export default function ReplayRequestsThrottledAlert() {
  return (
    <Alert.Container>
      <Alert type="info" showIcon data-test-id="replay-error">
        {t(
          'You are making too many requests. Reload the page to try again. (change this error message)'
        )}
      </Alert>
    </Alert.Container>
  );
}
