import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

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
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} size="sm" borderless>
          {currentLabel}
        </OverlayTrigger.Button>
      )}
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
        trigger={triggerProps => (
          <OverlayTrigger.Button {...triggerProps} size="sm" borderless>
            {currentSortLabel ?? triggerProps.children}
          </OverlayTrigger.Button>
        )}
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
        <Alert variant="danger" showIcon={false}>
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
    <ResultGridContainer>
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
    </ResultGridContainer>
  );
}

export default ResultGrid;

/**
 * Styles migrated from sentry/result-grid.less
 */
const ResultGridContainer = styled('div')`
  clear: both;

  .table-grid {
    width: 100%;
    max-width: 100%;
    margin-bottom: 20px;
  }

  .table-grid > thead > tr > th,
  .table-grid > tbody > tr > th,
  .table-grid > tfoot > tr > th,
  .table-grid > thead > tr > td,
  .table-grid > tbody > tr > td,
  .table-grid > tfoot > tr > td {
    vertical-align: top;
    border-top: 1px solid #f1eff3;
    padding: 15px 20px;
    line-height: 1.42857;
  }

  .table-grid > thead > tr > th {
    vertical-align: bottom;
    border-bottom: 2px solid #f1eff3;
  }

  .table-grid > caption + thead > tr:first-child > th,
  .table-grid > colgroup + thead > tr:first-child > th,
  .table-grid > thead:first-child > tr:first-child > th,
  .table-grid > caption + thead > tr:first-child > td,
  .table-grid > colgroup + thead > tr:first-child > td,
  .table-grid > thead:first-child > tr:first-child > td {
    border-top: 0;
  }

  .table-grid > tbody + tbody {
    border-top: 2px solid #f1eff3;
  }

  .table-grid .table {
    background-color: #fff;
  }

  .table-grid .label {
    text-transform: uppercase;
    margin-left: 10px;
    font-size: 0.5em;
    font-weight: 400;
  }

  .table-grid thead th {
    text-transform: uppercase;
    font-size: 12px;
  }

  td small {
    font-size: 0.8em;
  }

  .table-options {
    margin-bottom: 20px;
    position: relative;
  }

  .filter-options,
  .sort-options {
    margin-right: 5px;
    display: inline-block;
  }

  .sorted-by,
  .filter-options {
    color: inherit;
    background: #f9f9f9;
    margin-left: 5px;
    padding: 0 10px;
    font-weight: 600;
    display: inline-block;
  }

  .sorted-by:hover,
  .filter-options:hover {
    color: inherit;
  }

  .result-grid-search {
    float: right !important;
  }

  @media (min-width: 768px) {
    .result-grid-search .form-group {
      vertical-align: middle;
      margin-bottom: 0;
      display: inline-block;
    }

    .result-grid-search .form-control {
      vertical-align: middle;
      width: auto;
      display: inline-block;
    }

    .result-grid-search .form-control-static {
      display: inline-block;
    }

    .result-grid-search .control-label {
      vertical-align: middle;
      margin-bottom: 0;
    }

    .result-grid-search .radio,
    .result-grid-search .checkbox {
      vertical-align: middle;
      margin-top: 0;
      margin-bottom: 0;
      display: inline-block;
    }

    .result-grid-search .radio label,
    .result-grid-search .checkbox label {
      padding-left: 0;
    }

    .result-grid-search .radio input[type='radio'] {
      margin-left: 0;
      position: relative;
    }

    .result-grid-search .checkbox input[type='checkbox'] {
      margin-left: 0;
      position: relative;
    }

    .result-grid-search .has-feedback .form-control-feedback {
      top: 0;
    }
  }

  .result-grid-search .input-search {
    vertical-align: middle;
    padding: 3px 8px;
    font-size: 14px;
  }

  .result-grid-search .btn,
  .result-grid-search .btn-primary,
  .result-grid-search .btn-default {
    border: 0;
    margin-left: -10px;
    position: relative;
  }

  .result-grid-search .btn-sm {
    padding: 5px 10px;
  }
`;
