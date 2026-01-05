import {useCallback, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {GridBody} from 'sentry/components/tables/gridEditable/styles';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useCurrentHoverTime from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';
import {defaultLogFields} from 'sentry/views/explore/contexts/logs/fields';
import {
  LogsPageDataProvider,
  useLogsPageData,
} from 'sentry/views/explore/contexts/logs/logsPageData';
import {logsTimestampAscendingSortBy} from 'sentry/views/explore/contexts/logs/sortBys';
import {
  TraceItemAttributeProvider,
  useTraceItemAttributes,
} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {
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

export default function OurLogs() {
  const replay = useReplayReader();

  const startTimestampMs = replay?.getReplay()?.started_at?.getTime() ?? 0;

  const replayId = replay?.getReplay()?.id;
  const replayStartedAt = replay?.getReplay()?.started_at;
  const replayEndedAt = replay?.getReplay()?.finished_at;

  if (!replay || !defined(replayStartedAt) || !defined(replayEndedAt) || !replayId) {
    return (
      <BorderedSection isStatus>
        <GridBody>
          <LoadingRenderer />
        </GridBody>
      </BorderedSection>
    );
  }

  return (
    <LogsQueryParamsProvider
      analyticsPageSource={LogsAnalyticsPageSource.REPLAY_DETAILS}
      source="state"
      freeze={{replayId, replayStartedAt, replayEndedAt}}
      frozenParams={{
        sortBys: [logsTimestampAscendingSortBy],
        fields: rearrangedLogsReplayFields(defaultLogFields()),
      }}
    >
      <LogsPageDataProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.LOGS} enabled>
          <OurLogsContent startTimestampMs={startTimestampMs} replayId={replayId} />
        </TraceItemAttributeProvider>
      </LogsPageDataProvider>
    </LogsQueryParamsProvider>
  );
}

interface OurLogsContentProps {
  replayId: string;
  startTimestampMs: number;
}

function OurLogsContent({replayId, startTimestampMs}: OurLogsContentProps) {
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

  const embeddedOptions = useMemo(
    () => ({
      replay: {
        timestampRelativeTo: startTimestampMs,
        onReplayTimeClick: handleReplayTimeClick,
        displayReplayTimeIndicator: true,
        frames: replayFrames,
        currentTime,
        currentHoverTime,
      },
    }),
    [startTimestampMs, handleReplayTimeClick, replayFrames, currentTime, currentHoverTime]
  );

  return (
    <OurLogsContentWrapper>
      <OurLogFilters logItems={logItems} replayId={replayId} {...filterProps} />
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
            embeddedOptions={embeddedOptions}
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
  border-radius: ${p => p.theme.radius.md};
  ${p => p.isStatus && 'justify-content: center;'}
`;

const TableScrollContainer = styled('div')`
  overflow-y: auto;
  overflow-x: hidden;
  height: 100%;
  min-height: 0;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};
`;
