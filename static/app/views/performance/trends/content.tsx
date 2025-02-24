import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {CompactSelect} from 'sentry/components/compactSelect';
import {Alert} from 'sentry/components/core/alert';
import SearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import TransactionNameSearchBar from 'sentry/components/performance/searchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import type EventView from 'sentry/utils/discover/eventView';
import {generateAggregateFields} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withPageFilters from 'sentry/utils/withPageFilters';
import {TrendsHeader} from 'sentry/views/performance/trends/trendsHeader';
import getSelectedQueryKey from 'sentry/views/performance/trends/utils/getSelectedQueryKey';

import {getTransactionSearchQuery} from '../utils';

import ChangedTransactions from './changedTransactions';
import type {TrendFunctionField, TrendView} from './types';
import {TrendChangeType} from './types';
import {
  DEFAULT_MAX_DURATION,
  DEFAULT_TRENDS_STATS_PERIOD,
  getCurrentTrendFunction,
  getCurrentTrendParameter,
  modifyTransactionNameTrendsQuery,
  modifyTrendsViewDefaultPeriod,
  resetCursors,
  TRENDS_FUNCTIONS,
  TRENDS_PARAMETERS,
} from './utils';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  selection: PageFilters;
};

type State = {
  error?: string;
  previousTrendFunction?: TrendFunctionField;
};

export const defaultTrendsSelectionDate = {
  start: null,
  end: null,
  utc: false,
  period: DEFAULT_TRENDS_STATS_PERIOD,
};

class TrendsContent extends Component<Props, State> {
  state: State = {};

  handleSearch = (searchQuery: string) => {
    const {location} = this.props;

    const cursors = resetCursors();

    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        ...cursors,
        query: String(searchQuery).trim() || undefined,
      },
    });
  };

  setError = (error: string | undefined) => {
    this.setState({error});
  };

  handleTrendFunctionChange = (field: string) => {
    const {organization, location} = this.props;

    const offsets: Record<string, undefined> = {};

    Object.values(TrendChangeType).forEach(trendChangeType => {
      const queryKey = getSelectedQueryKey(trendChangeType);
      offsets[queryKey] = undefined;
    });

    trackAnalytics('performance_views.trends.change_function', {
      organization,
      function_name: field,
    });

    this.setState({
      previousTrendFunction: getCurrentTrendFunction(location).field,
    });

    const cursors = resetCursors();

    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        ...offsets,
        ...cursors,
        trendFunction: field,
      },
    });
  };

  renderError() {
    const {error} = this.state;

    if (!error) {
      return null;
    }

    return (
      <Alert.Container>
        <Alert type="error" showIcon>
          {error}
        </Alert>
      </Alert.Container>
    );
  }

  handleParameterChange = (label: string) => {
    const {organization, location} = this.props;
    const cursors = resetCursors();

    trackAnalytics('performance_views.trends.change_parameter', {
      organization,
      parameter_name: label,
    });

    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        ...cursors,
        trendParameter: label,
      },
    });
  };

  getFreeTextFromQuery(query: string) {
    const conditions = new MutableSearch(query);
    const transactionValues = conditions.getFilterValues('transaction');
    if (transactionValues.length) {
      return transactionValues[0];
    }
    if (conditions.freeText.length > 0) {
      // raw text query will be wrapped in wildcards in generatePerformanceEventView
      // so no need to wrap it here
      return conditions.freeText.join(' ');
    }
    return '';
  }

  render() {
    const {organization, eventView, location, projects} = this.props;
    const {previousTrendFunction} = this.state;

    const trendView = eventView.clone() as TrendView;
    modifyTrendsViewDefaultPeriod(trendView, location);

    if (organization.features.includes('performance-new-trends')) {
      modifyTransactionNameTrendsQuery(trendView);
    }

    const fields = generateAggregateFields(
      organization,
      [
        {
          field: 'absolute_correlation()',
        },
        {
          field: 'trend_percentage()',
        },
        {
          field: 'trend_difference()',
        },
        {
          field: 'count_percentage()',
        },
        {
          field: 'tpm()',
        },
        {
          field: 'tps()',
        },
      ],
      ['epm()', 'eps()']
    );
    const currentTrendFunction = getCurrentTrendFunction(location);
    const currentTrendParameter = getCurrentTrendParameter(
      location,
      projects,
      eventView.project
    );
    const query = getTransactionSearchQuery(location);

    return (
      <PageFiltersContainer
        defaultSelection={{
          datetime: defaultTrendsSelectionDate,
        }}
      >
        <TrendsHeader />
        <Layout.Body>
          <Layout.Main fullWidth>
            <DefaultTrends location={location} eventView={eventView} projects={projects}>
              <FilterActions>
                <PageFilterBar condensed>
                  <ProjectPageFilter />
                  <EnvironmentPageFilter />
                  <DatePageFilter />
                </PageFilterBar>
                {organization.features.includes('performance-new-trends') ? (
                  <StyledTransactionNameSearchBar
                    organization={organization}
                    eventView={trendView}
                    onSearch={this.handleSearch}
                    query={this.getFreeTextFromQuery(query)!}
                  />
                ) : (
                  <StyledSearchBar
                    searchSource="trends"
                    organization={organization}
                    projectIds={trendView.project}
                    query={query}
                    fields={fields}
                    onSearch={this.handleSearch}
                    maxQueryLength={MAX_QUERY_LENGTH}
                  />
                )}
                <CompactSelect
                  triggerProps={{prefix: t('Percentile')}}
                  value={currentTrendFunction.field}
                  options={TRENDS_FUNCTIONS.map(({label, field}) => ({
                    value: field,
                    label,
                  }))}
                  onChange={opt => this.handleTrendFunctionChange(opt.value)}
                />
                <CompactSelect
                  triggerProps={{prefix: t('Parameter')}}
                  value={currentTrendParameter.label}
                  options={TRENDS_PARAMETERS.map(({label}) => ({
                    value: label,
                    label,
                  }))}
                  onChange={opt => this.handleParameterChange(opt.value)}
                />
              </FilterActions>
              <ListContainer>
                <ChangedTransactions
                  trendChangeType={TrendChangeType.IMPROVED}
                  previousTrendFunction={previousTrendFunction}
                  trendView={trendView}
                  location={location}
                  setError={this.setError}
                  withBreakpoint={organization.features.includes(
                    'performance-new-trends'
                  )}
                />
                <ChangedTransactions
                  trendChangeType={TrendChangeType.REGRESSION}
                  previousTrendFunction={previousTrendFunction}
                  trendView={trendView}
                  location={location}
                  setError={this.setError}
                  withBreakpoint={organization.features.includes(
                    'performance-new-trends'
                  )}
                />
              </ListContainer>
            </DefaultTrends>
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    );
  }
}

type DefaultTrendsProps = {
  children: React.ReactNode[];
  eventView: EventView;
  location: Location;
  projects: Project[];
};

class DefaultTrends extends Component<DefaultTrendsProps> {
  hasPushedDefaults = false;

  render() {
    const {children, location, eventView, projects} = this.props;

    const queryString = decodeScalar(location.query.query);
    const trendParameter = getCurrentTrendParameter(
      location,
      projects,
      eventView.project
    );
    const conditions = new MutableSearch(queryString || '');

    if (queryString || this.hasPushedDefaults) {
      this.hasPushedDefaults = true;
      return <Fragment>{children}</Fragment>;
    }
    this.hasPushedDefaults = true;
    conditions.setFilterValues('tpm()', ['>0.01']);
    conditions.setFilterValues(trendParameter.column, ['>0', `<${DEFAULT_MAX_DURATION}`]);

    const query = conditions.formatString();
    eventView.query = query;

    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        query: String(query).trim() || undefined,
      },
    });
    return null;
  }
}

const FilterActions = styled('div')`
  display: grid;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: repeat(3, min-content);
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    grid-template-columns: auto 1fr auto auto;
  }
`;

const StyledSearchBar = styled(SearchBar)`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    order: 1;
    grid-column: 1/5;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    order: initial;
    grid-column: auto;
  }
`;

const StyledTransactionNameSearchBar = styled(TransactionNameSearchBar)`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    order: 1;
    grid-column: 1/5;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    order: initial;
    grid-column: auto;
  }
`;

const ListContainer = styled('div')`
  display: grid;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

export default withPageFilters(TrendsContent);
