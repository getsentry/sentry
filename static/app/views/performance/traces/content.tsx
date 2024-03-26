import {useCallback, useMemo} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import type {CursorHandler} from 'sentry/components/pagination';
import type {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import {space} from 'sentry/styles/space';
import {decodeInteger, decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useIndexedSpans} from 'sentry/views/starfish/queries/useIndexedSpans';
import {SpanIndexedField} from 'sentry/views/starfish/types';

import {TracesSearchBar} from './tracesSearchBar';
import {TracesSpansTable} from './tracesSpansTable';

const DEFAULT_PER_PAGE = 50;

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

  const fields = useMemo(() => {
    // TODO: make this dynamic
    return [
      SpanIndexedField.PROJECT,
      SpanIndexedField.ID,
      SpanIndexedField.TRACE,
      SpanIndexedField.SPAN_OP,
      SpanIndexedField.SPAN_DESCRIPTION,
      SpanIndexedField.TRANSACTION_OP,
      SpanIndexedField.TRANSACTION,
      SpanIndexedField.TIMESTAMP,
      SpanIndexedField.SPAN_DURATION,
      SpanIndexedField.SPAN_SELF_TIME,
    ];
  }, []);

  const spans = useIndexedSpans({
    fields,
    filters,
    limit,
    sorts: [],
    referrer: '',
  });

  return (
    <LayoutMain fullWidth>
      <PageFilterBar condensed>
        <ProjectPageFilter />
        <EnvironmentPageFilter />
        <DatePageFilter />
      </PageFilterBar>
      <TracesSearchBar query={query} handleSearch={handleSearch} />
      <TracesSpansTable
        fields={fields}
        isLoading={spans.isLoading}
        data={spans.data ?? []}
        pageLinks={spans.pageLinks}
        handleCursor={handleCursor}
      />
    </LayoutMain>
  );
}

const LayoutMain = styled(Layout.Main)`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;
