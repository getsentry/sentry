import {Alert} from 'sentry/components/core/alert';
import {t} from 'sentry/locale';

export default function ReplaySettingsAlert() {
  return (
    <Alert.Container>
      <Alert data-test-id="replay-settings-alert" type="info">
        {t(
          'Issues created from replay data (i.e., by toggling the settings below) will not consume your errors quota.'
        )}
      </Alert>
    </Alert.Container>
  );
}
