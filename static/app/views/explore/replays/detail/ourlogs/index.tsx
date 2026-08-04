import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Placeholder} from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {GridBody} from 'sentry/components/tables/gridEditable/styles';
import {t} from 'sentry/locale';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {defined} from 'sentry/utils/defined';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import {useCurrentHoverTime} from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {defaultLogFields} from 'sentry/views/explore/contexts/logs/fields';
import {
  LogsPageDataProvider,
  useLogsPageData,
} from 'sentry/views/explore/contexts/logs/logsPageData';
import {logsTimestampAscendingSortBy} from 'sentry/views/explore/contexts/logs/sortBys';
import {useLogItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {LogsItemContainer} from 'sentry/views/explore/logs/styles';
import {
  LoadingRenderer,
  LogsInfiniteTable,
} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {rearrangedLogsReplayFields} from 'sentry/views/explore/logs/tables/logsTableUtils';
import {useLogsSearchQueryBuilderProps} from 'sentry/views/explore/logs/useLogsSearchQueryBuilderProps';
import {
  useQueryParamsSearch,
  useSetQueryParamsSearch,
} from 'sentry/views/explore/queryParams/context';
import {FluidHeight} from 'sentry/views/explore/replays/detail/layout/fluidHeight';
import {NoRowRenderer} from 'sentry/views/explore/replays/detail/noRowRenderer';
import {OurLogFilters} from 'sentry/views/explore/replays/detail/ourlogs/ourlogFilters';
import {ourlogsAsFrames} from 'sentry/views/explore/replays/detail/ourlogs/ourlogsAsFrames';

export function OurLogs() {
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
        <OurLogsContent startTimestampMs={startTimestampMs} replayId={replayId} />
      </LogsPageDataProvider>
    </LogsQueryParamsProvider>
  );
}

interface OurLogsContentProps {
  replayId: string;
  startTimestampMs: number;
}

function OurLogsContent({replayId, startTimestampMs}: OurLogsContentProps) {
  const replayAttributeFilter = MutableSearch.fromQueryObject({
    [`sentry._internal.cooccuring.replay_id.${replayId}`]: ['true'],
  }).formatString();
  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useLogItemAttributes({query: replayAttributeFilter}, 'string');
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useLogItemAttributes({query: replayAttributeFilter}, 'number');
  const {attributes: booleanAttributes, secondaryAliases: booleanSecondaryAliases} =
    useLogItemAttributes({query: replayAttributeFilter}, 'boolean');

  const {currentTime, setCurrentTime} = useReplayContext();
  const [currentHoverTime] = useCurrentHoverTime();
  const replay = useReplayReader();

  const {infiniteLogsQueryResult} = useLogsPageData();
  const {data: logItems, isPending} = infiniteLogsQueryResult;

  const logsSearch = useQueryParamsSearch();
  const setLogsSearch = useSetQueryParamsSearch();
  const filterText = logsSearch.freeText.join(' ');
  const clearSearch = useCallback(
    () => setLogsSearch(new MutableSearch('')),
    [setLogsSearch]
  );

  const [hasAnyLogs, setHasAnyLogs] = useState(!!logItems?.length);
  const previousReplayId = useRef(replayId);
  useEffect(() => {
    if (previousReplayId.current !== replayId) {
      previousReplayId.current = replayId;
      setHasAnyLogs(!!logItems?.length);
      return;
    }
    if (logItems?.length) {
      setHasAnyLogs(true);
    }
  }, [logItems, replayId]);

  const {tracesItemSearchQueryBuilderProps, searchQueryBuilderProviderProps} =
    useLogsSearchQueryBuilderProps({
      attributeQuery: replayAttributeFilter,
      stringAttributes,
      numberAttributes,
      booleanAttributes,
      stringSecondaryAliases,
      numberSecondaryAliases,
      booleanSecondaryAliases,
    });

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
      <OurLogFilters
        replayId={replayId}
        searchQueryBuilderProps={tracesItemSearchQueryBuilderProps}
        searchQueryBuilderProviderProps={searchQueryBuilderProviderProps}
      />
      <LogsItemContainer border="primary" radius="md" flex="1 1 auto">
        {isPending ? (
          <Placeholder height="100%" />
        ) : (
          <LogsInfiniteTable
            stringAttributes={stringAttributes}
            numberAttributes={numberAttributes}
            booleanAttributes={booleanAttributes}
            embedded
            embeddedOptions={embeddedOptions}
            localOnlyItemFilters={{
              filteredItems: logItems,
              filterText,
            }}
            embeddedStyling={{disableBodyPadding: true, showVerticalScrollbar: false}}
            emptyRenderer={() => (
              <NoRowRenderer
                unfilteredItems={logItems}
                hasUnfilteredItems={hasAnyLogs}
                clearSearchTerm={clearSearch}
              >
                {t('No logs recorded')}
              </NoRowRenderer>
            )}
            analyticsPageSource={LogsAnalyticsPageSource.REPLAY_DETAILS}
          />
        )}
      </LogsItemContainer>
    </OurLogsContentWrapper>
  );
}

const OurLogsContentWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
`;

const BorderedSection = styled(FluidHeight)<{isStatus?: boolean}>`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  ${p => p.isStatus && 'justify-content: center;'}
`;
