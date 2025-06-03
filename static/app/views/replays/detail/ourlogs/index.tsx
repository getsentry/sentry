import {useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {GridBody} from 'sentry/components/gridEditable/styles';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {space} from 'sentry/styles/space';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useSearchQueryBuilderProps} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {LogsPageDataProvider} from 'sentry/views/explore/contexts/logs/logsPageData';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  TraceItemAttributeProvider,
  useTraceItemAttributes,
} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {
  EmptyRenderer,
  ErrorRenderer,
  LoadingRenderer,
  LogsInfiniteTable,
} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {TraceItemDataset} from 'sentry/views/explore/types';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import {useReplayTraces} from 'sentry/views/replays/detail/trace/useReplayTraces';

export default function OurLogs() {
  const {replay} = useReplayContext();
  const {replayTraces, indexComplete, indexError} = useReplayTraces({
    replayRecord: replay?.getReplay(),
  });

  const traceIds = useMemo(() => {
    if (!replayTraces?.length) {
      return undefined;
    }
    return replayTraces.map(trace => trace.traceSlug);
  }, [replayTraces]);

  if (indexError) {
    return (
      <BorderedSection isStatus>
        <StatusGridBody>
          <ErrorRenderer />
        </StatusGridBody>
      </BorderedSection>
    );
  }

  if (!replay || !indexComplete || !replayTraces) {
    return (
      <BorderedSection isStatus>
        <GridBody>
          <LoadingRenderer />
        </GridBody>
      </BorderedSection>
    );
  }

  if (!replayTraces.length) {
    return (
      <BorderedSection isStatus>
        <StatusGridBody>
          <EmptyRenderer hasSearch={false} />
        </StatusGridBody>
      </BorderedSection>
    );
  }

  return (
    <LogsPageParamsProvider
      analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
      isTableFrozen
      limitToTraceId={traceIds}
    >
      <LogsPageDataProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.LOGS} enabled>
          <OurLogsContent />
        </TraceItemAttributeProvider>
      </LogsPageDataProvider>
    </LogsPageParamsProvider>
  );
}

function OurLogsContent() {
  const {attributes: stringAttributes} = useTraceItemAttributes('string');
  const {attributes: numberAttributes} = useTraceItemAttributes('number');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const searchQueryBuilderProps = useSearchQueryBuilderProps({
    initialQuery: '',
    searchSource: 'replay-logs',
    onSearch: () => {}, // No-op since we don't want to allow search changes
    itemType: TraceItemDataset.LOGS,
    stringAttributes,
    numberAttributes,
  });

  return (
    <SearchQueryBuilderProvider {...searchQueryBuilderProps}>
      <PaddedFluidHeight ref={scrollContainerRef}>
        <LogsInfiniteTable
          stringAttributes={stringAttributes}
          numberAttributes={numberAttributes}
          showHeader
          allowPagination
          scrollContainer={scrollContainerRef}
        />
      </PaddedFluidHeight>
    </SearchQueryBuilderProvider>
  );
}

const PaddedFluidHeight = styled('div')`
  padding-top: ${space(1)};
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  flex-grow: 1;
`;

const BorderedSection = styled(FluidHeight)<{isStatus?: boolean}>`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  ${p => p.isStatus && 'justify-content: center;'}
`;

const StatusGridBody = styled(GridBody)`
  height: unset;
`;
