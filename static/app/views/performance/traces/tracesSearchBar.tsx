import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import SearchBar, {getHasTag} from 'sentry/components/events/searchBar';
import {IconAdd, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import useOrganization from 'sentry/utils/useOrganization';
import {SpanIndexedField} from 'sentry/views/starfish/types';

interface TracesSearchBarProps {
  handleClearSearch: (index: number) => boolean;
  handleSearch: (index: number, query: string) => void;
  queries: string[];
}

const getSpanName = (index: number) => {
  const spanNames = [t('Span A'), t('Span B'), t('Span C')];
  return spanNames[index];
};

const omitSupportedTags = [SpanIndexedField.SPAN_AI_PIPELINE_GROUP];

const getTracesSupportedTags = () => {
  const tags: TagCollection = Object.fromEntries(
    Object.values(SpanIndexedField)
      .filter(v => !omitSupportedTags.includes(v))
      .map(v => [v, {key: v, name: v}])
  );
  tags.has = getHasTag(tags);
  return tags;
};

export function TracesSearchBar({
  queries,
  handleSearch,
  handleClearSearch,
}: TracesSearchBarProps) {
  // TODO: load tags for autocompletion
  const organization = useOrganization();
  const canAddMoreQueries = queries.length <= 2;
  const localQueries = queries.length ? queries : [''];
  const supportedTags = getTracesSupportedTags();

  return (
    <TraceSearchBarsContainer>
      {localQueries.map((query, index) => (
        <TraceBar key={index}>
          <SpanLetter>{getSpanName(index)}</SpanLetter>
          <StyledSearchBar
            query={query}
            onSearch={(queryString: string) => handleSearch(index, queryString)}
            placeholder={t(
              'Search for traces containing a span matching these attributes'
            )}
            organization={organization}
            metricAlert={false}
            supportedTags={supportedTags}
            dataset={DiscoverDatasets.SPANS_INDEXED}
          />
          <StyledButton
            aria-label={t('Remove span')}
            icon={<IconClose size="sm" />}
            size="sm"
            onClick={() => (queries.length === 0 ? false : handleClearSearch(index))}
          />
        </TraceBar>
      ))}

      {canAddMoreQueries ? (
        <Button
          aria-label={t('Add query')}
          icon={<IconAdd size="xs" isCircled />}
          size="sm"
          onClick={() => handleSearch(localQueries.length, '')}
        >
          {t('Add Span')}
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

  color: ${p => p.theme.purple400};
  white-space: nowrap;
  font-weight: 800;
`;

const StyledSearchBar = styled(SearchBar)`
  width: 100%;
`;

const StyledButton = styled(Button)`
  height: 38px;
`;
