import {useCallback, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {GridBody} from 'sentry/components/tables/gridEditable/styles';
import {t} from 'sentry/locale';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useCurrentHoverTime from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';
import {defaultLogFields} from 'sentry/views/explore/contexts/logs/fields';
import {
  LogsPageDataProvider,
  useLogsPageData,
} from 'sentry/views/explore/contexts/logs/logsPageData';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {logsTimestampAscendingSortBy} from 'sentry/views/explore/contexts/logs/sortBys';
import {
  TraceItemAttributeProvider,
  useTraceItemAttributes,
} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {
  EmptyRenderer,
  ErrorRenderer,
  LoadingRenderer,
  LogsInfiniteTable,
} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {rearrangedLogsReplayFields} from 'sentry/views/explore/logs/tables/logsTableUtils';
import {TraceItemDataset} from 'sentry/views/explore/types';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import {OurLogFilters} from 'sentry/views/replays/detail/ourlogs/ourlogFilters';
import {ourlogsAsFrames} from 'sentry/views/replays/detail/ourlogs/ourlogsAsFrames';
import useOurLogFilters from 'sentry/views/replays/detail/ourlogs/useOurLogFilters';
import {useReplayTraces} from 'sentry/views/replays/detail/trace/useReplayTraces';

export default function OurLogs() {
  const replay = useReplayReader();
  const {replayTraces, indexComplete, indexError} = useReplayTraces({
    replayRecord: replay?.getReplay(),
  });

  const startTimestampMs = replay?.getReplay()?.started_at?.getTime() ?? 0;

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
    <LogsQueryParamsProvider
      source="state"
      freeze={traceIds ? {traceIds} : undefined}
      defaultParams={{
        sortBys: [logsTimestampAscendingSortBy],
        fields: rearrangedLogsReplayFields(defaultLogFields()),
      }}
    >
      <LogsPageParamsProvider
        analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        isTableFrozen
      >
        <LogsPageDataProvider>
          <TraceItemAttributeProvider traceItemType={TraceItemDataset.LOGS} enabled>
            <OurLogsContent startTimestampMs={startTimestampMs} traceIds={traceIds} />
          </TraceItemAttributeProvider>
        </LogsPageDataProvider>
      </LogsPageParamsProvider>
    </LogsQueryParamsProvider>
  );
}

interface OurLogsContentProps {
  startTimestampMs: number;
  traceIds?: string[];
}

function OurLogsContent({traceIds, startTimestampMs}: OurLogsContentProps) {
  const {attributes: stringAttributes} = useTraceItemAttributes('string');
  const {attributes: numberAttributes} = useTraceItemAttributes('number');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const {currentTime, setCurrentTime} = useReplayContext();
  const [currentHoverTime] = useCurrentHoverTime();
  const replay = useReplayReader();

  const {infiniteLogsQueryResult} = useLogsPageData();
  const {data: logItems = [], isPending} = infiniteLogsQueryResult;

  const filterProps = useOurLogFilters({logItems});
  const {items: filteredLogItems, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');

  const handleReplayTimeClick = useCallback(
    (offsetMs: string) => {
      const offsetTime = parseFloat(offsetMs);
      if (!isNaN(offsetTime)) {
        setCurrentTime(offsetTime);
      }
    },
    [setCurrentTime]
  );

  // Generate pseudo-frames for jump button functionality
  const replayFrames = useMemo(() => {
    if (!replay || !logItems) {
      return [];
    }
    return ourlogsAsFrames(startTimestampMs, logItems);
  }, [replay, logItems, startTimestampMs]);

  return (
    <OurLogsContentWrapper>
      <OurLogFilters logItems={logItems} traceIds={traceIds} {...filterProps} />
      <TableScrollContainer ref={scrollContainerRef}>
        {isPending ? (
          <Placeholder height="100%" />
        ) : (
          <LogsInfiniteTable
            stringAttributes={stringAttributes}
            numberAttributes={numberAttributes}
            scrollContainer={scrollContainerRef}
            allowPagination
            embedded
            embeddedOptions={{
              replay: {
                timestampRelativeTo: startTimestampMs,
                onReplayTimeClick: handleReplayTimeClick,
                displayReplayTimeIndicator: true,
                currentTime,
                currentHoverTime,
                frames: replayFrames,
              },
            }}
            localOnlyItemFilters={{
              filteredItems: filteredLogItems,
              filterText: filterProps.searchTerm,
            }}
            embeddedStyling={{disableBodyPadding: true, showVerticalScrollbar: false}}
            emptyRenderer={() => (
              <NoRowRenderer unfilteredItems={logItems} clearSearchTerm={clearSearchTerm}>
                {t('No logs recorded')}
              </NoRowRenderer>
            )}
          />
        )}
      </TableScrollContainer>
    </OurLogsContentWrapper>
  );
}

const OurLogsContentWrapper = styled('div')`
  display: grid;
  grid-template-rows: min-content 1fr;
  height: 100%;
  min-height: 0;
`;

const BorderedSection = styled(FluidHeight)<{isStatus?: boolean}>`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  ${p => p.isStatus && 'justify-content: center;'}
`;

const StatusGridBody = styled(GridBody)`
  height: unset;
`;

const TableScrollContainer = styled('div')`
  overflow-y: auto;
  overflow-x: hidden;
  height: 100%;
  min-height: 0;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;
