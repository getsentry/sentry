import React from 'react';
import {Location} from 'history';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {GlobalSelection, Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import {t} from 'app/locale';
import Feature from 'app/components/acl/feature';
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
  return (
    selection.projects &&
    (selection.projects.length > 1 || selection.projects[0] === ALL_ACCESS_PROJECTS)
  );
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
    const {location} = this.props;

    const offsets = {};

    Object.values(TrendChangeType).forEach(trendChangeType => {
      const queryKey = getSelectedQueryKey(trendChangeType);
      offsets[queryKey] = 0;
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
    const currentTrendFunction = getCurrentTrendFunction(location);
    const query = getTransactionSearchQuery(location);
    const showChangedProjects = hasMultipleProjects(selection);

    return (
      <Feature features={['trends', 'internal-catchall']} requireAll={false}>
        <DefaultTrends location={location} eventView={eventView}>
          <StyledSearchContainer>
            <StyledSearchBar
              organization={organization}
              projectIds={trendView.project}
              query={query}
              fields={trendView.fields}
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

function DefaultTrends(props: DefaultTrendsProps) {
  const {children, location, eventView} = props;

  const queryString = decodeScalar(location.query.query) || '';
  const conditions = tokenizeSearch(queryString);

  if (queryString) {
    return <React.Fragment>{children}</React.Fragment>;
  } else {
    conditions.setTag('count()', ['>1000']);
    conditions.setTag('transaction.duration', ['>0']);
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
  return null;
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

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
  }
`;

export default withGlobalSelection(TrendsContent);
