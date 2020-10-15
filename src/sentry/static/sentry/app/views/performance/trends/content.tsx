import React from 'react';
import {Location} from 'history';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {GlobalSelection, Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {generateAggregateFields} from 'app/utils/discover/fields';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import {t} from 'app/locale';
import Feature from 'app/components/acl/feature';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import SearchBar from 'app/views/events/searchBar';
import space from 'app/styles/space';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';
import {decodeScalar} from 'app/utils/queryString';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';

import {getTransactionSearchQuery} from '../utils';
import {TrendChangeType, TrendView, TrendFunctionField} from './types';
import {TRENDS_FUNCTIONS, getCurrentTrendFunction, getSelectedQueryKey} from './utils';
import ChangedTransactions from './changedTransactions';
import ChangedProjects from './changedProjects';
import {FilterViews} from '../landing';
import Alert from 'app/components/alert';
import ExternalLink from 'app/components/links/externalLink';

type Props = {
  organization: Organization;
  location: Location;
  eventView: EventView;
  selection: GlobalSelection;
};

type State = {
  previousTrendFunction?: TrendFunctionField;
};

function hasMultipleProjects(selection: GlobalSelection) {
  const myProjectsSelected = selection.projects.length === 0;
  const allProjectsSelected = selection.projects[0] === ALL_ACCESS_PROJECTS;
  return myProjectsSelected || allProjectsSelected || selection.projects.length > 1;
}

class TrendsContent extends React.Component<Props, State> {
  state: State = {};

  handleSearch = (searchQuery: string) => {
    const {location} = this.props;

    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        query: String(searchQuery).trim() || undefined,
      },
    });
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

    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        ...offsets,
        trendFunction: field,
      },
    });
  };

  render() {
    const {organization, eventView, selection, location} = this.props;
    const {previousTrendFunction} = this.state;

    const trendView = eventView.clone() as TrendView;
    const fields = generateAggregateFields(organization, [
      {
        field: 'absolute_correlation()',
      },
    ]);
    const currentTrendFunction = getCurrentTrendFunction(location);
    const query = getTransactionSearchQuery(location);
    const showChangedProjects = hasMultipleProjects(selection);

    return (
      <Feature features={['trends']}>
        <DefaultTrends location={location} eventView={eventView}>
          <Alert type="info">
            {t(
              "Performance trends is a new beta feature for organizations who have turned on Early Adopter in their account settings. We'd love to hear any feedback you have at"
            )}{' '}
            <ExternalLink href="mailto:performance-feedback@sentry.io">
              performance-feedback@sentry.io
            </ExternalLink>
          </Alert>
          <StyledSearchContainer>
            <StyledSearchBar
              organization={organization}
              projectIds={trendView.project}
              query={query}
              fields={fields}
              onSearch={this.handleSearch}
            />
            <TrendsDropdown>
              <DropdownControl
                buttonProps={{prefix: t('Display')}}
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
          </StyledSearchContainer>
          <TrendsLayoutContainer>
            {showChangedProjects && (
              <ChangedProjects
                trendChangeType={TrendChangeType.IMPROVED}
                previousTrendFunction={previousTrendFunction}
                trendView={trendView}
                location={location}
              />
            )}
            {showChangedProjects && (
              <ChangedProjects
                trendChangeType={TrendChangeType.REGRESSION}
                previousTrendFunction={previousTrendFunction}
                trendView={trendView}
                location={location}
              />
            )}
            <ChangedTransactions
              trendChangeType={TrendChangeType.IMPROVED}
              previousTrendFunction={previousTrendFunction}
              trendView={trendView}
              location={location}
            />
            <ChangedTransactions
              trendChangeType={TrendChangeType.REGRESSION}
              previousTrendFunction={previousTrendFunction}
              trendView={trendView}
              location={location}
            />
          </TrendsLayoutContainer>
        </DefaultTrends>
      </Feature>
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
    const conditions = tokenizeSearch(queryString || '');

    if (queryString || this.hasPushedDefaults) {
      return <React.Fragment>{children}</React.Fragment>;
    } else {
      conditions.setTagValues('count()', ['>1000']);
      conditions.setTagValues('transaction.duration', ['>0']);
    }

    const query = stringifyQueryObject(conditions);
    eventView.query = query;

    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        query: String(query).trim() || undefined,
        view: FilterViews.TRENDS,
      },
    });
    this.hasPushedDefaults = true;
    return null;
  }
}

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
  margin-bottom: ${space(2)};
  margin-right: ${space(1)};
`;

const TrendsDropdown = styled('div')`
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
