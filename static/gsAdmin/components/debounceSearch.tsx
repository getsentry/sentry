import type {ReactElement} from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import SearchBar from 'sentry/components/searchBar';
import {space} from 'sentry/styles/space';
import useApi from 'sentry/utils/useApi';
import useKeyPress from 'sentry/utils/useKeyPress';

type Props = {
  onSelectResult: (value: string) => void;
  path: string;
  placeholder: string;
  suggestionContent: (suggestion: any) => ReactElement;
  createSuggestionPath?: (suggestion: any) => string;
  host?: string;
  onSearch?: (value: string) => void;
  queryParam?: string;
};

function DebounceSearch({
  createSuggestionPath,
  onSearch,
  onSelectResult,
  host,
  path,
  placeholder,
  queryParam = '',
  suggestionContent,
}: Props) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [queryResults, setQueryResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [node, setNode] = useState<HTMLDivElement | null>();
  const setKeyHandlers = useCallback((nodeRef: HTMLDivElement | null) => {
    setNode(nodeRef);
  }, []);
  const downPress = useKeyPress('ArrowDown', node);
  const upPress = useKeyPress('ArrowUp', node);
  const enterPress = useKeyPress('Enter', node);
  const escapePress = useKeyPress('Escape', node);

  const [cursor, setCursor] = useState<number>(0);

  const api = useApi();

  const debouncedSearch = useRef(
    debounce(async (searchHost, value) => {
      // Avoid slow-fetch race conditions
      api.clear();
      setError('');
      setQueryResults([]);

      if (value) {
        try {
          const queryParams = {
            query: [queryParam, value].filter(v => v).join(':'),
            per_page: 10,
          };
          const results = await api.requestPromise(path, {
            method: 'GET',
            host: searchHost,
            data: queryParams,
          });
          setQueryResults(results);
        } catch (err) {
          setError((err as Error).message);
        }
      }
      setLoading(false);
      value ? setShowResults(true) : setShowResults(false);
    }, 300)
  ).current;

  const onChange = useCallback(
    (value: string) => {
      value ? setLoading(true) : setLoading(false);
      value ? setShowResults(true) : setShowResults(false);
      setQuery(value);
      debouncedSearch(host, value);
    },
    [host, debouncedSearch]
  );

  useEffect(() => {
    if (queryResults.length && downPress) {
      setCursor(prevState =>
        prevState < queryResults.length ? prevState + 1 : prevState
      );
    }
  }, [downPress, queryResults.length]);

  useEffect(() => {
    if (queryResults.length && upPress) {
      setCursor(prevState => (prevState > 0 ? prevState - 1 : prevState));
    }
  }, [upPress, queryResults.length]);

  useEffect(() => {
    if (enterPress && cursor === 0) {
      if (onSearch) {
        onSearch(query);
      } else {
        onChange(query);
      }
    } else if (enterPress && cursor <= queryResults.length) {
      const item = queryResults[cursor - 1]!;
      onSelectResult(item);
    }
  }, [cursor, enterPress, onChange, onSearch, onSelectResult, query, queryResults]);

  useEffect(() => {
    api.clear();
    setCursor(0);
    setError('');
    setLoading(false);
    setQueryResults([]);
    setShowResults(false);
  }, [escapePress, debouncedSearch, api, host]);

  const renderSuggestion = (item: any, idx: number) => {
    return (
      <a
        target="_blank"
        href={createSuggestionPath?.(item)}
        rel="noreferrer"
        key={item.id}
      >
        <SuggestionCard highlight={cursor === idx + 1}>
          {suggestionContent(item)}
        </SuggestionCard>
      </a>
    );
  };

  return (
    <div>
      <div ref={setKeyHandlers}>
        <SearchBar
          placeholder={placeholder}
          onChange={onChange}
          style={error ? {border: '1px solid red'} : {}}
        />
      </div>
      <SearchResults>
        {loading && <LoadingIndicator />}
        {!loading && showResults && queryResults.map(renderSuggestion)}
        {!loading && showResults && !queryResults.length && <Card>No results found</Card>}
      </SearchResults>
      {error && <Error>{error}</Error>}
    </div>
  );
}

const Card = styled('div')<{highlight?: boolean}>`
  background: ${p =>
    p.highlight ? p.theme.colors.gray100 : p.theme.tokens.background.primary};
  color: ${p => (p.highlight ? p.theme.active : p.theme.tokens.content.primary)};
  box-shadow: ${p => p.theme.dropShadowMedium};
  padding: ${space(2)};
`;
const Error = styled('div')`
  color: red;
`;
const SearchResults = styled('div')`
  margin-bottom: ${space(2)};
`;
const SuggestionCard = styled(Card)`
  &:hover {
    color: ${p => p.theme.active};
    background: ${p => p.theme.colors.gray100};
    cursor: pointer;
  }
`;

export default DebounceSearch;
