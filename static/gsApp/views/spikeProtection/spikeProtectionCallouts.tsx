import {Alert} from 'sentry/components/core/alert';
import {t} from 'sentry/locale';

export function SpikeProtectionRangeLimitation() {
  return (
    <Alert.Container>
      <Alert variant="warning" showIcon={false}>
        {t(
          "To view this project's spike data on the chart, please select a time range greater than or equal to 6h or less than 30d"
        )}
      </Alert>
    </Alert.Container>
  );
}
