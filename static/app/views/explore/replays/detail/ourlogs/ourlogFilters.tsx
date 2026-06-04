import styled from '@emotion/styled';

import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import {
  TraceItemSearchQueryBuilder,
  type TraceItemSearchQueryBuilderProps,
  type useTraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {FiltersGrid} from 'sentry/views/explore/replays/detail/filtersGrid';
import {OpenInLogsButton} from 'sentry/views/explore/replays/detail/ourlogs/openInLogsButton';

type Props = {
  searchQueryBuilderProps: TraceItemSearchQueryBuilderProps;
  searchQueryBuilderProviderProps: ReturnType<typeof useTraceItemSearchQueryBuilderProps>;
  replayId?: string;
};

const REPLAY_LOGS_PLACEHOLDER = t('Search on log levels, messages, and more');

export function OurLogFilters({
  replayId,
  searchQueryBuilderProps,
  searchQueryBuilderProviderProps,
}: Props) {
  return (
    <SearchQueryBuilderProvider
      {...searchQueryBuilderProviderProps}
      placeholder={REPLAY_LOGS_PLACEHOLDER}
    >
      <StyledFiltersGrid>
        <TraceItemSearchQueryBuilder {...searchQueryBuilderProps} />
        <OpenInLogsButton replayId={replayId} />
      </StyledFiltersGrid>
    </SearchQueryBuilderProvider>
  );
}

const StyledFiltersGrid = styled(FiltersGrid)`
  grid-template-columns: 1fr min-content;
`;
