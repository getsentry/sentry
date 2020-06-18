import React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/browser';
import * as ReactRouter from 'react-router';
import {Location} from 'history';
import omit from 'lodash/omit';
import isEqual from 'lodash/isEqual';

import {Organization, GlobalSelection} from 'app/types';
import {PageContent} from 'app/styles/organization';
import {Client} from 'app/api';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {fetchTotalCount} from 'app/actionCreators/events';
import {loadOrganizationTags} from 'app/actionCreators/tags';
import Alert from 'app/components/alert';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import space from 'app/styles/space';
import SearchBar from 'app/views/events/searchBar';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import EventView, {isAPIPayloadSimilar} from 'app/utils/discover/eventView';
import {ContentBox, Main, Side} from 'app/utils/discover/styles';
import {generateQueryWithTag} from 'app/utils';
import localStorage from 'app/utils/localStorage';
import {decodeScalar} from 'app/utils/queryString';

import {DEFAULT_EVENT_VIEW} from './data';
import Table from './table';
import Tags from './tags';
import ResultsHeader from './resultsHeader';
import ResultsChart from './resultsChart';
import {generateTitle} from './utils';

type Props = {
  api: Client;
  router: ReactRouter.InjectedRouter;
  location: Location;
  organization: Organization;
  selection: GlobalSelection;
};

type State = {
  eventView: EventView;
  error: string;
  errorCode: number;
  totalValues: null | number;
  showTags: boolean;
};
const SHOW_TAGS_STORAGE_KEY = 'discover2:show-tags';

function readShowTagsState() {
  const value = localStorage.getItem(SHOW_TAGS_STORAGE_KEY);
  return value === '1';
}

class Results extends React.Component<Props, State> {
  static getDerivedStateFromProps(nextProps: Props, prevState: State): State {
    const eventView = EventView.fromLocation(nextProps.location);
    return {...prevState, eventView};
  }

  state = {
    eventView: EventView.fromLocation(this.props.location),
    error: '',
    errorCode: 200,
    totalValues: null,
    showTags: readShowTagsState(),
  };

  componentDidMount() {
    const {api, organization, selection} = this.props;
    loadOrganizationTags(api, organization.slug, selection);
    this.checkEventView();
    this.fetchTotalCount();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const {api, location, organization, selection} = this.props;
    const {eventView} = this.state;

    this.checkEventView();
    const currentQuery = eventView.getEventsAPIPayload(location);
    const prevQuery = prevState.eventView.getEventsAPIPayload(prevProps.location);
    if (!isAPIPayloadSimilar(currentQuery, prevQuery)) {
      api.clear();
      this.fetchTotalCount();
      if (
        !isEqual(prevQuery.statsPeriod, currentQuery.statsPeriod) ||
        !isEqual(prevQuery.start, currentQuery.start) ||
        !isEqual(prevQuery.end, currentQuery.end) ||
        !isEqual(prevQuery.project, currentQuery.project)
      ) {
        loadOrganizationTags(api, organization.slug, selection);
      }
    }
  }

  async fetchTotalCount() {
    const {api, organization, location} = this.props;
    const {eventView} = this.state;
    if (!eventView.isValid()) {
      return;
    }

    try {
      const totals = await fetchTotalCount(
        api,
        organization.slug,
        eventView.getEventsAPIPayload(location)
      );
      this.setState({totalValues: totals});
    } catch (err) {
      Sentry.captureException(err);
    }
  }

  checkEventView() {
    const {eventView} = this.state;
    if (eventView.isValid()) {
      return;
    }
    // If the view is not valid, redirect to a known valid state.
    const {location, organization, selection} = this.props;
    const nextEventView = EventView.fromNewQueryWithLocation(
      DEFAULT_EVENT_VIEW,
      location
    );
    if (nextEventView.project.length === 0 && selection.projects) {
      nextEventView.project = selection.projects;
    }

    ReactRouter.browserHistory.replace(
      nextEventView.getResultsViewUrlTarget(organization.slug)
    );
  }

  handleChangeShowTags = () => {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'discover_v2.results.toggle_tag_facets',
      eventName: 'Discoverv2: Toggle Tag Facets',
      organization_id: parseInt(organization.id, 10),
    });
    this.setState(state => {
      const newValue = !state.showTags;
      localStorage.setItem(SHOW_TAGS_STORAGE_KEY, newValue ? '1' : '0');
      return {...state, showTags: newValue};
    });
  };

  handleSearch = (query: string) => {
    const {router, location} = this.props;

    const queryParams = getParams({
      ...(location.query || {}),
      query,
    });

    // do not propagate pagination when making a new search
    const searchQueryParams = omit(queryParams, 'cursor');

    router.push({
      pathname: location.pathname,
      query: searchQueryParams,
    });
  };

  handleYAxisChange = (value: string) => {
    const {router, location} = this.props;

    const newQuery = {
      ...location.query,
      yAxis: value,
    };

    router.push({
      pathname: location.pathname,
      query: newQuery,
    });

    trackAnalyticsEvent({
      eventKey: 'discover_v2.y_axis_change',
      eventName: "Discoverv2: Change chart's y axis",
      organization_id: parseInt(this.props.organization.id, 10),
      y_axis_value: value,
    });
  };

  handleDisplayChange = (value: string) => {
    const {router, location} = this.props;

    const newQuery = {
      ...location.query,
      display: value,
    };

    router.push({
      pathname: location.pathname,
      query: newQuery,
    });
  };

  getDocumentTitle(): string {
    const {eventView} = this.state;
    if (!eventView) {
      return '';
    }
    return generateTitle({eventView});
  }

  renderTagsTable() {
    const {organization, location} = this.props;
    const {eventView, totalValues} = this.state;

    return (
      <Side>
        <Tags
          generateUrl={this.generateTagUrl}
          totalValues={totalValues}
          eventView={eventView}
          organization={organization}
          location={location}
        />
      </Side>
    );
  }

  generateTagUrl = (key: string, value: string) => {
    const {organization} = this.props;
    const {eventView} = this.state;

    const url = eventView.getResultsViewUrlTarget(organization.slug);
    url.query = generateQueryWithTag(url.query, {
      key,
      value,
    });
    return url;
  };

  renderError(error: string) {
    if (!error) {
      return null;
    }
    return (
      <Alert type="error" icon="icon-circle-exclamation">
        {error}
      </Alert>
    );
  }

  setError = (error: string, errorCode: number) => {
    this.setState({error, errorCode});
  };

  render() {
    const {organization, location, router} = this.props;
    const {eventView, error, errorCode, totalValues, showTags} = this.state;
    const query = decodeScalar(location.query.query) || '';
    const title = this.getDocumentTitle();

    return (
      <SentryDocumentTitle title={title} objSlug={organization.slug}>
        <StyledPageContent>
          <LightWeightNoProjectMessage organization={organization}>
            <ResultsHeader
              errorCode={errorCode}
              organization={organization}
              location={location}
              eventView={eventView}
            />
            <ContentBox>
              <Top>
                {this.renderError(error)}
                <StyledSearchBar
                  organization={organization}
                  projectIds={eventView.project}
                  query={query}
                  fields={eventView.fields}
                  onSearch={this.handleSearch}
                />
                <ResultsChart
                  router={router}
                  organization={organization}
                  eventView={eventView}
                  location={location}
                  onAxisChange={this.handleYAxisChange}
                  onDisplayChange={this.handleDisplayChange}
                  total={totalValues}
                />
              </Top>
              <StyledMain isCollapsed={!!showTags}>
                <Table
                  organization={organization}
                  eventView={eventView}
                  location={location}
                  title={title}
                  setError={this.setError}
                  onChangeShowTags={this.handleChangeShowTags}
                  showTags={showTags}
                />
              </StyledMain>
              {showTags ? this.renderTagsTable() : null}
            </ContentBox>
          </LightWeightNoProjectMessage>
        </StyledPageContent>
      </SentryDocumentTitle>
    );
  }
}

// These styled components are used in getsentry to create a paywall page.
// Be careful changing their interfaces.

export const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

export const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(2)};
`;

export const Top = styled('div')`
  grid-column: 1/3;
  flex-grow: 0;
`;

export const StyledMain = styled(Main)<{isCollapsed: boolean}>`
  grid-column: ${p => (p.isCollapsed ? '1/2' : '1/3')};
`;

function ResultsContainer(props: Props) {
  /**
   * Block `<Results>` from mounting until GSH is ready since there are API
   * requests being performed on mount.
   *
   * Also, we skip loading last used projects if you have multiple projects feature as
   * you no longer need to enforce a project if it is empty. We assume an empty project is
   * the desired behavior because saved queries can contain a project filter.
   */
  return (
    <GlobalSelectionHeader
      skipLoadLastUsed={props.organization.features.includes('global-views')}
    >
      <Results {...props} />
    </GlobalSelectionHeader>
  );
}

export default withApi(withOrganization(withGlobalSelection(ResultsContainer)));
