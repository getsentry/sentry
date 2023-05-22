import {Component, Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {CompactSelect} from 'sentry/components/compactSelect';
import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import SearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import TransactionNameSearchBar from 'sentry/components/performance/searchBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, PageFilters, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {generateAggregateFields} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withPageFilters from 'sentry/utils/withPageFilters';

import {getPerformanceLandingUrl, getTransactionSearchQuery} from '../utils';

import ChangedTransactions from './changedTransactions';
import {TrendChangeType, TrendFunctionField, TrendView} from './types';
import {
  DEFAULT_MAX_DURATION,
  DEFAULT_TRENDS_STATS_PERIOD,
  getCurrentTrendFunction,
  getCurrentTrendParameter,
  getSelectedQueryKey,
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

    const offsets = {};

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
      <Alert type="error" showIcon>
        {error}
      </Alert>
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

  getPerformanceLink() {
    const {location} = this.props;

    const newQuery = {
      ...location.query,
    };
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);

    // This stops errors from occurring when navigating to other views since we are appending aggregates to the trends view
    conditions.removeFilter('tpm()');
    conditions.removeFilter('confidence()');
    conditions.removeFilter('transaction.duration');
    newQuery.query = conditions.formatString();
    return {
      pathname: getPerformanceLandingUrl(this.props.organization),
      query: newQuery,
    };
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
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {
                  label: 'Performance',
                  to: this.getPerformanceLink(),
                },
                {
                  label: 'Trends',
                },
              ]}
            />
            <Layout.Title>{t('Trends')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>
            <DefaultTrends location={location} eventView={eventView} projects={projects}>
              <FilterActions>
                <PageFilterBar condensed>
                  <ProjectPageFilter />
                  <EnvironmentPageFilter />
                  <DatePageFilter alignDropdown="left" />
                </PageFilterBar>
                {organization.features.includes('performance-new-trends') ? (
                  <StyledTransactionNameSearchBar
                    organization={organization}
                    eventView={trendView}
                    onSearch={this.handleSearch}
                    query={this.getFreeTextFromQuery(query)}
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
              <Feature features={['organizations:performance-trendsv2-dev-only']}>
                <ListContainer>
                  <ChangedTransactions
                    trendChangeType={TrendChangeType.IMPROVED}
                    previousTrendFunction={previousTrendFunction}
                    trendView={trendView}
                    location={location}
                    setError={this.setError}
                  />
                  <ChangedTransactions
                    trendChangeType={TrendChangeType.REGRESSION}
                    previousTrendFunction={previousTrendFunction}
                    trendView={trendView}
                    location={location}
                    setError={this.setError}
                  />
                </ListContainer>
              </Feature>
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
