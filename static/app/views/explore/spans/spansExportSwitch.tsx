import {useShowExploreModalExport} from 'sentry/views/explore/components/exports/useShowExploreModalExport';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {SpansExport} from 'sentry/views/explore/spans/spansExport';
import {TracesExportModalButton} from 'sentry/views/explore/spans/tracesExportModalButton';
import type {RawCounts} from 'sentry/views/explore/useRawCounts';

type SpansExportSwitchProps = {
  aggregatesTableResult: AggregatesTableResult;
  rawSpanCounts: RawCounts;
  spansTableResult: SpansTableResult;
};

export function SpansExportSwitch({
  aggregatesTableResult,
  rawSpanCounts,
  spansTableResult,
}: SpansExportSwitchProps) {
  const showModalExport = useShowExploreModalExport();

  if (showModalExport) {
    return (
      <TracesExportModalButton
        aggregatesTableResult={aggregatesTableResult}
        spansTableResult={spansTableResult}
        rawSpanCounts={rawSpanCounts}
      />
    );
  }

  return (
    <SpansExport
      aggregatesTableResult={aggregatesTableResult}
      spansTableResult={spansTableResult}
    />
  );
}
