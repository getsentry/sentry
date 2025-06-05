import Duration from 'sentry/components/duration';
import {TextAlignRight} from 'sentry/views/insights/common/components/textAlign';
import type {CellThreshold} from 'sentry/views/insights/pages/platform/shared/table/ThresholdCell';
import {ThresholdCell} from 'sentry/views/insights/pages/platform/shared/table/ThresholdCell';

export function DurationCell({
  milliseconds,
  thresholds,
}: {
  milliseconds: number;
  thresholds?: CellThreshold;
}) {
  return (
    <ThresholdCell value={milliseconds} thresholds={thresholds}>
      <TextAlignRight>
        <Duration seconds={milliseconds / 1000} fixedDigits={2} abbreviation />
      </TextAlignRight>
    </ThresholdCell>
  );
}
