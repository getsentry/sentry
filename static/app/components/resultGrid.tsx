import {useEffect, useMemo, useState} from 'react';

import type {RequestOptions} from 'sentry/api';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import Pagination from 'sentry/components/pagination';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {browserHistory} from 'sentry/utils/browserHistory';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';

type Option = [value: string, label: string];

type FilterProps = {
  name: string;
  options: Option[];
  path: string;
  queryKey: string;
  value: string;
};

function Filter({name, options, path, queryKey, value}: FilterProps) {
  const location = useLocation();

  const currentLabel = useMemo(() => {
    const selected = options.find(item => item[0] === (value ?? ''));
    if (selected) {
      return name + ': ' + selected[1];
    }
    return name + ': ' + 'Any';
  }, [name, options, value]);

  const selector = (
    <CompactSelect
      triggerProps={{
        size: 'sm',
        borderless: true,
      }}
      triggerLabel={currentLabel}
      options={[
        {
          value: 'any',
          label: 'Any',
        },
        ...options.map(([optValue, label]) => ({
          value: optValue,
          label,
        })),
      ]}
      value={value ?? 'any'}
      onChange={({value: selectedValue}) => {
        if (selectedValue === 'any') {
          const query = {...location.query, cursor: undefined, [queryKey]: undefined};
          browserHistory.push({pathname: path, query});
        } else {
          browserHistory.push({
            pathname: path,
            query: {
              ...location.query,
              [queryKey]: selectedValue,
              cursor: undefined,
            },
          });
        }
      }}
    />
  );

  return (
    <div className="filter-options">
      {options.length === 1 ? <strong>{currentLabel}</strong> : selector}
    </div>
  );
}

type SortByProps = {
  options: Option[];
  path: string;
  value: string;
};

function SortBy({options, path, value}: SortByProps) {
  const location = useLocation();
  const currentSortLabel = useMemo(
    () => options.find(([optValue]) => optValue === value)?.[1],
    [options, value]
  );

  if (options.length === 0) {
    return null;
  }

  const sortBySelector = (
    <div className="sort-options">
      <CompactSelect
        triggerLabel={currentSortLabel}
        triggerProps={{
          size: 'sm',
          borderless: true,
        }}
        options={options.map(option => ({
          value: option[0],
          label: option[1],
        }))}
        onChange={({value: selected}) => {
          browserHistory.push({
            pathname: path,
            query: {...location.query, sortBy: selected, cursor: undefined},
          });
        }}
        value={value}
      />
    </div>
  );

  return (
    <div className="sort-options">
      Showing results sorted by{' '}
      {options.length === 1 ? (
        <strong className="sorted-by">{currentSortLabel}</strong>
      ) : (
        sortBySelector
      )}
    </div>
  );
}

type FilterConfig = {
  name: string;
  options: Option[];
};

// XXX(ts): Using Partial here on the DefaultProps is not really correct, since
// defaultProps guarantees they'll be set. But because this component is
// wrapped with a HoC, we lose the defaultProps, and users of the component
type Props = Partial<DefaultProps>;

type DefaultProps = {
  columns: React.ReactNode[];
  columnsForRow: (row: any) => React.ReactNode[];
  defaultParams: Record<string, any>;
  defaultSort: string;
  endpoint: string;
  filters: Record<string, FilterConfig>;
  hasPagination: boolean;
  hasSearch: boolean;
  keyForRow: (row: any) => string;
  method: RequestOptions['method'];
  path: string;
  sortOptions: Option[];
};

type State = {
  error: string | boolean;
  filters: Record<string, string>;
  loading: boolean;
  pageLinks: null | string;
  query: string;
  rows: any[];
  sortBy: string;
};

function ResultGrid(props: Props) {
  const api = useApi({persistInFlight: true});
  const location = useLocation();

  const {
    path = '',
    endpoint = '',
    method = 'GET',
    columns = [],
    sortOptions = [],
    filters = {},
    defaultSort = '',
    keyForRow = (row: any) => row.id,
    columnsForRow = (_row: any) => [],
    defaultParams = {per_page: 50},
    hasPagination = true,
    hasSearch = false,
  } = props;

  const buildDefaultState = (): State => {
    const queryParams = location.query;
    return {
      rows: [],
      loading: true,
      error: false,
      pageLinks: null,
      query: (queryParams.query as string | undefined) ?? '',
      sortBy: (queryParams.sortBy as string | undefined) ?? defaultSort,
      filters: {...queryParams} as Record<string, string>,
    };
  };

  const [state, setState] = useState<State>(buildDefaultState());

  useEffect(() => {
    const queryParams = location.query;
    const nextSortBy = (queryParams.sortBy as string | undefined) ?? defaultSort;

    setState(prev => ({
      ...prev,
      query: (queryParams.query as string | undefined) ?? '',
      sortBy: nextSortBy,
      filters: {...queryParams} as Record<string, string>,
      pageLinks: null,
      loading: true,
      error: false,
    }));

    const requestParams = {
      ...defaultParams,
      sortBy: nextSortBy,
      ...queryParams,
    };

    api.request(endpoint, {
      method: method as RequestOptions['method'],
      data: requestParams,
      success: (data, _, resp) => {
        setState(prev => ({
          ...prev,
          loading: false,
          error: false,
          rows: data,
          pageLinks: resp?.getResponseHeader('Link') ?? null,
        }));
      },
      error: () => {
        setState(prev => ({
          ...prev,
          loading: false,
          error: true,
        }));
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, endpoint, method, defaultSort, JSON.stringify(defaultParams)]);

  const onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    const targetQueryParams = {...location.query, query: state.query, cursor: ''};

    e.preventDefault();

    browserHistory.push({
      pathname: path,
      query: targetQueryParams,
    });
  };

  const onQueryChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    setState(prev => ({...prev, query: evt.target.value}));
  };

  const renderLoading = () => (
    <tr>
      <td colSpan={columns.length}>
        <div className="loading">
          <div className="loading-indicator" />
          <div className="loading-message">Hold on to your butts!</div>
        </div>
      </td>
    </tr>
  );

  const renderError = () => (
    <tr>
      <td colSpan={columns.length}>
        <Alert type="error" showIcon={false}>
          Something bad happened :(
        </Alert>
      </td>
    </tr>
  );

  const renderNoResults = () => (
    <tr>
      <td colSpan={columns.length}>No results found.</td>
    </tr>
  );

  const renderResults = () =>
    state.rows.map(row => <tr key={keyForRow?.(row)}>{columnsForRow?.(row)}</tr>);

  return (
    <div className="result-grid">
      <div className="table-options">
        {hasSearch && (
          <div className="result-grid-search">
            <form onSubmit={onSearch}>
              <div className="form-group">
                <input
                  type="text"
                  className="form-control input-search"
                  placeholder="search"
                  style={{width: 300}}
                  name="query"
                  autoComplete="off"
                  value={state.query}
                  onChange={onQueryChange}
                />
                <Button
                  type="submit"
                  size="sm"
                  priority="primary"
                  icon={<IconSearch size="xs" />}
                  aria-label={t('Search')}
                />
              </div>
            </form>
          </div>
        )}
        <SortBy options={sortOptions ?? []} value={state.sortBy} path={path ?? ''} />
        {Object.keys(filters ?? {}).map(filterKey => (
          <Filter
            key={filterKey}
            queryKey={filterKey}
            value={state.filters[filterKey]!}
            path={path ?? ''}
            {...(filters?.[filterKey] as FilterConfig)}
          />
        ))}
      </div>

      <table className="table table-grid">
        <thead>
          <tr>{columns}</tr>
        </thead>
        <tbody>
          {state.loading
            ? renderLoading()
            : state.error
              ? renderError()
              : state.rows.length === 0
                ? renderNoResults()
                : renderResults()}
        </tbody>
      </table>
      {hasPagination && state.pageLinks && <Pagination pageLinks={state.pageLinks} />}
    </div>
  );
}

export default ResultGrid;
