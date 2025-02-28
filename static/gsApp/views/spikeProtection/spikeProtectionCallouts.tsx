import {Alert} from 'sentry/components/core/alert';
import {t} from 'sentry/locale';

export function SpikeProtectionRangeLimitation() {
  return (
    <Alert.Container>
      <Alert type="warning">
        {t(
          "To view this project's spike data on the chart, please select a time range between 30d and 6h"
        )}
      </Alert>
    </Alert.Container>
  );
}
