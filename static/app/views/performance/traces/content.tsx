import {useCallback, useMemo} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import type {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {decodeInteger, decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useIndexedSpans} from 'sentry/views/starfish/queries/useIndexedSpans';

import {fields} from './data';
import {TraceRow} from './traceRow';
import {TracesSearchBar} from './tracesSearchBar';

const DEFAULT_PER_PAGE = 20;

export function Content() {
  const location = useLocation();

  const query = useMemo(() => {
    return decodeScalar(location.query.query, '');
  }, [location.query.query]);

  const limit = useMemo(() => {
    return decodeInteger(location.query.perPage, DEFAULT_PER_PAGE);
  }, [location.query.perPage]);

  const handleSearch: SmartSearchBarProps['onSearch'] = useCallback(
    (searchQuery: string) => {
      browserHistory.push({
        ...location,
        query: {
          ...location.query,
          cursor: undefined,
          query: searchQuery || undefined,
        },
      });
    },
    [location]
  );

  const handleCursor: CursorHandler = useCallback((newCursor, pathname, newQuery) => {
    browserHistory.push({
      pathname,
      query: {...newQuery, cursor: newCursor},
    });
  }, []);

  const filters = useMemo(() => new MutableSearch(query ?? '').filters, [query]);

  const spansQuery = useIndexedSpans({
    fields,
    filters,
    limit,
    sorts: [],
    referrer: 'api.trace-explorer.table',
  });

  const traces = useMemo(() => {
    const data = (spansQuery.data ?? []).reduce((acc, span) => {
      const traceId = span.trace;
      if (!defined(traceId)) {
        // TODO: warn missing trace id
        return acc;
      }

      let spansList = acc.get(traceId);
      if (!defined(spansList)) {
        spansList = [];
        acc.set(traceId, spansList);
      }

      spansList.push(span);
      return acc;
    }, new Map());

    return Array.from(data);
  }, [spansQuery.data]);

  return (
    <LayoutMain fullWidth>
      <PageFilterBar condensed>
        <ProjectPageFilter />
        <EnvironmentPageFilter />
        <DatePageFilter />
      </PageFilterBar>
      <TracesSearchBar query={query} handleSearch={handleSearch} />
      {traces.map(([traceId, spans]) => (
        <TraceRow key={traceId} traceId={traceId} spans={spans} />
      ))}
      <StyledPagination pageLinks={spansQuery.pageLinks} onCursor={handleCursor} />
    </LayoutMain>
  );
}

const LayoutMain = styled(Layout.Main)`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const StyledPagination = styled(Pagination)`
  margin: 0px;
`;
