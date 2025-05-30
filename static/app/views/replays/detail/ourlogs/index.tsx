import {useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import useOrganization from 'sentry/utils/useOrganization';
import {useSearchQueryBuilderProps} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {LogsPageDataProvider} from 'sentry/views/explore/contexts/logs/logsPageData';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  TraceItemAttributeProvider,
  useTraceItemAttributes,
} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {LogsInfiniteTable} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {LogsTable} from 'sentry/views/explore/logs/tables/logsTable';
import {TraceItemDataset} from 'sentry/views/explore/types';
import EmptyState from 'sentry/views/replays/detail/emptyState';
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
      <BorderedSection>
        <EmptyState withIcon={false}>
          <p>{t('Unable to retrieve logs')}</p>
        </EmptyState>
      </BorderedSection>
    );
  }

  if (!replay || !indexComplete || !replayTraces) {
    return (
      <BorderedSection>
        <EmptyState>
          <p>{t('Loading logs...')}</p>
        </EmptyState>
      </BorderedSection>
    );
  }

  if (!replayTraces.length) {
    return (
      <BorderedSection>
        <EmptyState>
          <p>{t('No logs found for this replay')}</p>
        </EmptyState>
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
  const organization = useOrganization();
  const hasInfiniteFeature = organization.features.includes('ourlogs-live-refresh');
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
      <PaddedFluidHeight ref={scrollContainerRef} fullHeight={!hasInfiniteFeature}>
        {hasInfiniteFeature ? (
          <LogsInfiniteTable
            stringAttributes={stringAttributes}
            numberAttributes={numberAttributes}
            showHeader
            allowPagination
            scrollContainer={scrollContainerRef}
          />
        ) : (
          <LogsTable showHeader={false} allowPagination />
        )}
      </PaddedFluidHeight>
    </SearchQueryBuilderProvider>
  );
}

const PaddedFluidHeight = styled('div')<{fullHeight?: boolean}>`
  padding-top: ${space(1)};
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  flex-grow: 1;
  ${p => p.fullHeight && 'height: 100%;'}
`;

const BorderedSection = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;
