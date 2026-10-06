import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Container, Stack} from '@sentry/scraps/layout';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {
  SearchQueryBuilderProvider,
  useSearchQueryBuilderLayout,
  useSearchQueryBuilderState,
} from 'sentry/components/searchQueryBuilder/context';
import {SearchQueryBuilderValueCombobox} from 'sentry/components/searchQueryBuilder/tokens/filter/valueCombobox';
import {parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useIssueListSearchBarDataProvider} from 'sentry/views/issueList/searchBar';

interface Props {
  fieldKey: string;
  onClose: () => void;
  onSearch: (query: string) => void;
  query: string;
}

export function IssueFilterValueMenu({fieldKey, query, onSearch, onClose}: Props) {
  const {selection: pageFilters} = usePageFilters();
  const {getFilterKeys, getFilterKeySections, getTagValues} =
    useIssueListSearchBarDataProvider({pageFilters});
  const [initialQuery] = useState(() =>
    parseSearch(query)?.some(
      token => token.type === Token.FILTER && getKeyName(token.key) === fieldKey
    )
      ? query
      : `${query} ${fieldKey}:""`.trim()
  );

  return (
    <SearchQueryBuilderProvider
      initialQuery={initialQuery}
      filterKeys={getFilterKeys()}
      filterKeySections={getFilterKeySections()}
      getTagValues={getTagValues}
      searchSource="main_search"
      menuPresentation="panel"
      onSearch={onSearch}
      disallowLogicalOperators
    >
      <FilterValueMenuContent
        fieldKey={fieldKey}
        initialQuery={initialQuery}
        onClose={onClose}
      />
    </SearchQueryBuilderProvider>
  );
}

function FilterValueMenuContent({
  fieldKey,
  initialQuery,
  onClose,
}: Pick<Props, 'fieldKey' | 'onClose'> & {initialQuery: string}) {
  const lastAppliedQuery = useRef(initialQuery);
  const {parsedQuery, query, dispatch, handleSearch} = useSearchQueryBuilderState();
  const {wrapperRef, panelRef, setMenuContainer} = useSearchQueryBuilderLayout();
  const token = parsedQuery?.find(
    item => item.type === Token.FILTER && getKeyName(item.key) === fieldKey
  );

  useEffect(() => {
    if (!token || token.type !== Token.FILTER || query === lastAppliedQuery.current) {
      return;
    }
    lastAppliedQuery.current = query;
    const value = token.value;
    const empty =
      value.type === Token.VALUE_TEXT_LIST || value.type === Token.VALUE_NUMBER_LIST
        ? value.items.length === 0
        : value.value === '';
    if (empty) {
      const search = new MutableSearch(query);
      search.removeFilter(`${token.negated ? '!' : ''}${fieldKey}`);
      handleSearch(search.formatString());
    } else {
      handleSearch(query);
    }
  }, [fieldKey, handleSearch, query, token]);

  if (!token || token.type !== Token.FILTER) {
    return null;
  }

  return (
    <Stack ref={panelRef} width="320px" maxWidth="calc(100vw - 32px)">
      <Container ref={wrapperRef} padding="lg" borderBottom="primary">
        <SearchQueryBuilderValueCombobox
          token={token}
          wrapperRef={wrapperRef}
          editingCommittedValue
          selectionOnly
          onCommit={() => dispatch({type: 'COMMIT_QUERY'})}
          onDelete={onClose}
        />
      </Container>
      <ValueMenu ref={setMenuContainer} />
    </Stack>
  );
}

const ValueMenu = styled(Container)`
  [data-overlay] {
    width: 100%;
    max-width: 100%;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
`;
