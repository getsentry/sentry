import {TextAlignRight} from 'sentry/views/insights/common/components/textAlign';
import {ThresholdCell} from 'sentry/views/insights/pages/platform/shared/table/ThresholdCell';

const errorRateColorThreshold = {
  error: 0.1,
  warning: 0.05,
} as const;

export function ErrorRateCell({errorRate}: {errorRate: number}) {
  return (
    <ThresholdCell value={errorRate} thresholds={errorRateColorThreshold}>
      <TextAlignRight>{(errorRate * 100).toFixed(2)}%</TextAlignRight>
    </ThresholdCell>
  );
}
