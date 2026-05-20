import styled from '@emotion/styled';

import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import {
  TraceItemSearchQueryBuilder,
  type TraceItemSearchQueryBuilderProps,
  useTraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {FiltersGrid} from 'sentry/views/explore/replays/detail/filtersGrid';
import {OpenInLogsButton} from 'sentry/views/explore/replays/detail/ourlogs/openInLogsButton';

type Props = {
  searchQueryBuilderProps: TraceItemSearchQueryBuilderProps;
  replayId?: string;
};

export function OurLogFilters({replayId, searchQueryBuilderProps}: Props) {
  const searchQueryBuilderProviderProps = useTraceItemSearchQueryBuilderProps(
    searchQueryBuilderProps
  );

  return (
    <SearchQueryBuilderProvider {...searchQueryBuilderProviderProps}>
      <StyledFiltersGrid>
        <TraceItemSearchQueryBuilder
          {...searchQueryBuilderProps}
          placeholder={t('Search on log levels, messages, and more')}
        />
        <OpenInLogsButton replayId={replayId} />
      </StyledFiltersGrid>
    </SearchQueryBuilderProvider>
  );
}

const StyledFiltersGrid = styled(FiltersGrid)`
  grid-template-columns: 1fr min-content;
`;
