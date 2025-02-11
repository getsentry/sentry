import {Alert} from 'sentry/components/alert';
import {t} from 'sentry/locale';

export function SpikeProtectionRangeLimitation() {
  return (
    <Alert type="warning">
      {t(
        "To view this project's spike data on the chart, please select a time range between 30d and 6h"
      )}
    </Alert>
  );
}
