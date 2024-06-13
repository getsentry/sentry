import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import SearchBar from 'sentry/components/events/searchBar';
import {IconAdd, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import useOrganization from 'sentry/utils/useOrganization';
import {useSpanFieldSupportedTags} from 'sentry/views/performance/utils/useSpanFieldSupportedTags';

interface TracesSearchBarProps {
  handleClearSearch: (index: number) => boolean;
  handleSearch: (index: number, query: string) => void;
  queries: string[];
}

const getSpanName = (index: number) => {
  const spanNames = [
    t('Find traces where a span is'),
    t('and another span where'),
    t('and another span where'),
  ];
  return spanNames[index];
};

// Since trace explorer permits cross project searches,
// autocompletion should also be cross projects.
const ALL_PROJECTS = [-1];

export function TracesSearchBar({
  queries,
  handleSearch,
  handleClearSearch,
}: TracesSearchBarProps) {
  // TODO: load tags for autocompletion
  const organization = useOrganization();
  const canAddMoreQueries = queries.length <= 2;
  const localQueries = queries.length ? queries : [''];
  const supportedTags = useSpanFieldSupportedTags({
    projects: ALL_PROJECTS,
  });

  return (
    <TraceSearchBarsContainer>
      {localQueries.map((query, index) => (
        <TraceBar key={index}>
          <SpanLetter>{getSpanName(index)}</SpanLetter>
          <StyledSearchBar
            searchSource="trace-explorer"
            query={query}
            onSearch={(queryString: string) => handleSearch(index, queryString)}
            placeholder={t('Search for span attributes')}
            organization={organization}
            metricAlert={false}
            supportedTags={supportedTags}
            dataset={DiscoverDatasets.SPANS_INDEXED}
            projectIds={ALL_PROJECTS}
          />
          <StyledButton
            aria-label={t('Remove span')}
            icon={<IconClose size="sm" />}
            size="sm"
            onClick={() => {
              trackAnalytics('trace_explorer.remove_span_condition', {
                organization,
              });
              if (queries.length >= 0) {
                handleClearSearch(index);
              }
            }}
          />
        </TraceBar>
      ))}

      {canAddMoreQueries ? (
        <Button
          aria-label={t('Add query')}
          icon={<IconAdd size="xs" isCircled />}
          size="sm"
          onClick={() => {
            trackAnalytics('trace_explorer.add_span_condition', {
              organization,
            });
            handleSearch(localQueries.length, '');
          }}
        >
          {t('Add Span Condition')}
        </Button>
      ) : null}
    </TraceSearchBarsContainer>
  );
}

const TraceSearchBarsContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: ${space(1)};
`;

const TraceBar = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  gap: ${space(1)};
`;

const SpanLetter = styled('div')`
  background-color: ${p => p.theme.purple100};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)} ${space(2)};
  text-align: center;
  min-width: 220px;
  color: ${p => p.theme.purple400};
  white-space: nowrap;
  font-weight: ${p => p.theme.fontWeightBold};
`;

const StyledSearchBar = styled(SearchBar)`
  width: 100%;
`;

const StyledButton = styled(Button)`
  height: 38px;
`;
