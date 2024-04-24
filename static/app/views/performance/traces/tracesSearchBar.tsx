import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import SearchBar from 'sentry/components/events/searchBar';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

interface TracesSearchBarProps {
  handleClearSearch: (index: number) => boolean;
  handleSearch: (index: number, query: string) => void;
  queries: string[];
}

export function TracesSearchBar({
  queries,
  handleSearch,
  handleClearSearch,
}: TracesSearchBarProps) {
  // TODO: load tags for autocompletion
  const organization = useOrganization();
  return (
    <TraceSearchBarsContainer>
      {queries.map((query, index) => (
        <TraceBar key={index}>
          {index !== 0 ? <BridgeLine key={index} /> : null}
          <StyledSearchBar
            query={query}
            onSearch={(queryString: string) => handleSearch(index, queryString)}
            placeholder={t('Filter by tags')}
            organization={organization}
            onClearSearch={() => (queries.length <= 1 ? false : handleClearSearch(index))}
            alwaysShowClearSearch
          />
        </TraceBar>
      ))}

      {queries.length ? null : (
        <StyledSearchBar
          query={''}
          onSearch={(queryString: string) => handleSearch(queries.length, queryString)}
          placeholder={t('Filter by tags')}
          organization={organization}
          alwaysShowClearSearch
        />
      )}

      <TraceBar>
        <BridgeLine />
        <Button
          aria-label={t('Add query')}
          icon={<IconAdd size="xs" />}
          size="sm"
          onClick={() => handleSearch(queries.length + 1, '')}
        />
      </TraceBar>
    </TraceSearchBarsContainer>
  );
}

const TraceSearchBarsContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
`;

const TraceBar = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  width: 100%;
`;

const StyledSearchBar = styled(SearchBar)`
  width: 100%;
`;

function BridgeLine() {
  const theme = useTheme();
  return (
    <svg width="10" height="10" style={{marginLeft: '14px'}}>
      <line x1="5" y1="0" x2="5" y2="10" stroke={theme.gray300} />
    </svg>
  );
}
