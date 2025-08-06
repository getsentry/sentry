import {useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import Placeholder from 'sentry/components/placeholder';
import {GridBody} from 'sentry/components/tables/gridEditable/styles';
import {t} from 'sentry/locale';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import {
  LogsPageDataProvider,
  useLogsPageData,
} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  LogsPageParamsProvider,
  useLogsLimitToTraceId,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
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
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import {OurLogFilters} from 'sentry/views/replays/detail/ourlogs/ourlogFilters';
import useOurLogFilters from 'sentry/views/replays/detail/ourlogs/useOurLogFilters';
import {useReplayTraces} from 'sentry/views/replays/detail/trace/useReplayTraces';

export default function OurLogs() {
  const replay = useReplayReader();
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
          <EmptyRenderer />
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

  const {infiniteLogsQueryResult} = useLogsPageData();
  const {data: logItems = [], isPending} = infiniteLogsQueryResult;
  const limitToTraceId = useLogsLimitToTraceId();
  const traceIds = Array.isArray(limitToTraceId)
    ? limitToTraceId
    : limitToTraceId
      ? [limitToTraceId]
      : undefined;

  const filterProps = useOurLogFilters({logItems});
  const {items: filteredLogItems, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');

  return (
    <Flex direction="column" wrap="nowrap">
      <OurLogFilters logItems={logItems} traceIds={traceIds} {...filterProps} />
      <OurLogsReplayTableWrapper>
        {isPending ? (
          <Placeholder height="100%" />
        ) : (
          <PaddedFluidHeight ref={scrollContainerRef}>
            <LogsInfiniteTable
              stringAttributes={stringAttributes}
              numberAttributes={numberAttributes}
              scrollContainer={scrollContainerRef}
              allowPagination
              embedded
              localOnlyItemFilters={{
                filteredItems: filteredLogItems,
                filterText: filterProps.searchTerm,
              }}
              embeddedStyling={{disableBodyPadding: true}}
              emptyRenderer={() => (
                <NoRowRenderer
                  unfilteredItems={logItems}
                  clearSearchTerm={clearSearchTerm}
                >
                  {t('No logs recorded')}
                </NoRowRenderer>
              )}
            />
          </PaddedFluidHeight>
        )}
      </OurLogsReplayTableWrapper>
    </Flex>
  );
}

const PaddedFluidHeight = styled('div')`
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

const OurLogsReplayTableWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  flex-grow: 1;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;
