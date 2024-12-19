import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {SpanSearchQueryBuilder} from 'sentry/components/performance/spanSearchQueryBuilder';
import {IconAdd, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

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

export function TracesSearchBar({
  queries,
  handleSearch,
  handleClearSearch,
}: TracesSearchBarProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const canAddMoreQueries = queries.length <= 2;
  const localQueries = queries.length ? queries : [''];

  return (
    <TraceSearchBarsContainer>
      {localQueries.map((query, index) => (
        <TraceBar key={index}>
          <SpanLetter>{getSpanName(index)}</SpanLetter>
          <SpanSearchQueryBuilder
            projects={selection.projects}
            initialQuery={query}
            onSearch={(queryString: string) => handleSearch(index, queryString)}
            searchSource="trace-explorer"
          />
          <StyledButton
            aria-label={t('Remove Span')}
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
          aria-label={t('Add Query')}
          icon={<IconAdd size="xs" isCircled />}
          size="sm"
          onClick={() => {
            trackAnalytics('trace_explorer.add_span_condition', {
              organization,
            });
            handleSearch(localQueries.length, '');
          }}
        >
          {t('Add Another Span')}
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
  width: 100%;
  gap: ${space(1)};
`;

const SpanLetter = styled('div')`
  background-color: ${p => p.theme.purple100};
  border-radius: ${p => p.theme.borderRadius};
  text-align: center;
  min-width: 220px;
  color: ${p => p.theme.purple400};
  white-space: nowrap;
  font-weight: ${p => p.theme.fontWeightBold};
  align-content: center;
`;

const StyledButton = styled(Button)`
  height: 38px;
`;
