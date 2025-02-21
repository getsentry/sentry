import {Alert} from 'sentry/components/alert';
import {t} from 'sentry/locale';

export default function ReplaySettingsAlert() {
  return (
    <Alert data-test-id="replay-settings-alert" type="info">
      {t(
        'Issues created from replay data (i.e., by toggling the settings below) will not consume your errors quota.'
      )}
    </Alert>
  );
}
