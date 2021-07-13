import * as React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Alert from 'app/components/alert';
import Breadcrumbs from 'app/components/breadcrumbs';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import SearchBar from 'app/components/events/searchBar';
import * as Layout from 'app/components/layouts/thirds';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {MAX_QUERY_LENGTH} from 'app/constants';
import {IconFlag} from 'app/icons/iconFlag';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import EventView from 'app/utils/discover/eventView';
import {generateAggregateFields} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';
import {tokenizeSearch} from 'app/utils/tokenizeSearch';
import withGlobalSelection from 'app/utils/withGlobalSelection';

import {getPerformanceLandingUrl, getTransactionSearchQuery} from '../utils';

import ChangedTransactions from './changedTransactions';
import {TrendChangeType, TrendFunctionField, TrendView} from './types';
import {
  DEFAULT_MAX_DURATION,
  DEFAULT_TRENDS_STATS_PERIOD,
  getCurrentTrendFunction,
  getCurrentTrendParameter,
  getSelectedQueryKey,
  getTrendsParameters,
  modifyTrendsViewDefaultPeriod,
  resetCursors,
  TRENDS_FUNCTIONS,
} from './utils';

type Props = {
  organization: Organization;
  location: Location;
  eventView: EventView;
  selection: GlobalSelection;
};

type State = {
  error?: string;
  previousTrendFunction?: TrendFunctionField;
};

class TrendsContent extends React.Component<Props, State> {
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

    trackAnalyticsEvent({
      eventKey: 'performance_views.trends.change_function',
      eventName: 'Performance Views: Change Function',
      organization_id: parseInt(organization.id, 10),
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
      <Alert type="error" icon={<IconFlag size="md" />}>
        {error}
      </Alert>
    );
  }

  handleParameterChange = (label: string) => {
    const {organization, location} = this.props;
    const cursors = resetCursors();

    trackAnalyticsEvent({
      eventKey: 'performance_views.trends.change_parameter',
      eventName: 'Performance Views: Change Parameter',
      organization_id: parseInt(organization.id, 10),
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

  getPerformanceLink() {
    const {location} = this.props;

    const newQuery = {
      ...location.query,
    };
    const query = decodeScalar(location.query.query, '');
    const conditions = tokenizeSearch(query);

    // This stops errors from occurring when navigating to other views since we are appending aggregates to the trends view
    conditions.removeTag('tpm()');
    conditions.removeTag('confidence()');
    conditions.removeTag('transaction.duration');
    newQuery.query = conditions.formatString();
    return {
      pathname: getPerformanceLandingUrl(this.props.organization),
      query: newQuery,
    };
  }

  render() {
    const {organization, eventView, location} = this.props;
    const {previousTrendFunction} = this.state;

    const trendView = eventView.clone() as TrendView;
    modifyTrendsViewDefaultPeriod(trendView, location);

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
    const currentTrendParameter = getCurrentTrendParameter(location);
    const query = getTransactionSearchQuery(location);

    const TRENDS_PARAMETERS = getTrendsParameters({
      canSeeSpanOpTrends: organization.features.includes('performance-ops-breakdown'),
    });

    return (
      <GlobalSelectionHeader
        defaultSelection={{
          datetime: {
            start: null,
            end: null,
            utc: false,
            period: DEFAULT_TRENDS_STATS_PERIOD,
          },
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
            <DefaultTrends location={location} eventView={eventView}>
              <StyledSearchContainer>
                <StyledSearchBar
                  searchSource="trends"
                  organization={organization}
                  projectIds={trendView.project}
                  query={query}
                  fields={fields}
                  onSearch={this.handleSearch}
                  maxQueryLength={MAX_QUERY_LENGTH}
                />
                <TrendsDropdown>
                  <DropdownControl
                    buttonProps={{prefix: t('Percentile')}}
                    label={currentTrendFunction.label}
                  >
                    {TRENDS_FUNCTIONS.map(({label, field}) => (
                      <DropdownItem
                        key={field}
                        onSelect={this.handleTrendFunctionChange}
                        eventKey={field}
                        data-test-id={field}
                        isActive={field === currentTrendFunction.field}
                      >
                        {label}
                      </DropdownItem>
                    ))}
                  </DropdownControl>
                </TrendsDropdown>
                <TrendsDropdown>
                  <DropdownControl
                    buttonProps={{prefix: t('Parameter')}}
                    label={currentTrendParameter.label}
                  >
                    {TRENDS_PARAMETERS.map(({label}) => (
                      <DropdownItem
                        key={label}
                        onSelect={this.handleParameterChange}
                        eventKey={label}
                        data-test-id={label}
                        isActive={label === currentTrendParameter.label}
                      >
                        {label}
                      </DropdownItem>
                    ))}
                  </DropdownControl>
                </TrendsDropdown>
              </StyledSearchContainer>
              <TrendsLayoutContainer>
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
              </TrendsLayoutContainer>
            </DefaultTrends>
          </Layout.Main>
        </Layout.Body>
      </GlobalSelectionHeader>
    );
  }
}

type DefaultTrendsProps = {
  children: React.ReactNode[];
  location: Location;
  eventView: EventView;
};

class DefaultTrends extends React.Component<DefaultTrendsProps> {
  hasPushedDefaults = false;

  render() {
    const {children, location, eventView} = this.props;

    const queryString = decodeScalar(location.query.query);
    const trendParameter = getCurrentTrendParameter(location);
    const conditions = tokenizeSearch(queryString || '');

    if (queryString || this.hasPushedDefaults) {
      this.hasPushedDefaults = true;
      return <React.Fragment>{children}</React.Fragment>;
    } else {
      this.hasPushedDefaults = true;
      conditions.setTagValues('tpm()', ['>0.01']);
      conditions.setTagValues(trendParameter.column, ['>0', `<${DEFAULT_MAX_DURATION}`]);
    }

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

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
  margin-bottom: ${space(2)};
`;

const TrendsDropdown = styled('div')`
  margin-left: ${space(1)};
  flex-grow: 0;
`;

const StyledSearchContainer = styled('div')`
  display: flex;
`;

const TrendsLayoutContainer = styled('div')`
  display: grid;
  grid-gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
  }
`;

export default withGlobalSelection(TrendsContent);
