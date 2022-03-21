import * as React from 'react';
import {browserHistory, InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {updateSavedQueryVisit} from 'sentry/actionCreators/discoverSavedQueries';
import {fetchTotalCount} from 'sentry/actionCreators/events';
import {fetchProjectsCount} from 'sentry/actionCreators/projects';
import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
import AsyncComponent from 'sentry/components/asyncComponent';
import Confirm from 'sentry/components/confirm';
import {CreateAlertFromViewButton} from 'sentry/components/createAlertButton';
import SearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {IconFlag} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {Organization, PageFilters, SavedQuery} from 'sentry/types';
import {defined, generateQueryWithTag} from 'sentry/utils';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import EventView, {isAPIPayloadSimilar} from 'sentry/utils/discover/eventView';
import {formatTagKey, generateAggregateFields} from 'sentry/utils/discover/fields';
import {
  DisplayModes,
  MULTI_Y_AXIS_SUPPORTED_DISPLAY_MODES,
} from 'sentry/utils/discover/types';
import localStorage from 'sentry/utils/localStorage';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';

import {addRoutePerformanceContext} from '../performance/utils';

import {DEFAULT_EVENT_VIEW} from './data';
import ResultsChart from './resultsChart';
import ResultsHeader from './resultsHeader';
import Table from './table';
import Tags from './tags';
import {generateTitle} from './utils';

type Props = {
  api: Client;
  loading: boolean;
  location: Location;
  organization: Organization;
  router: InjectedRouter;
  selection: PageFilters;
  savedQuery?: SavedQuery;
};

type State = {
  confirmedQuery: boolean;
  error: string;
  errorCode: number;
  eventView: EventView;
  incompatibleAlertNotice: React.ReactNode;
  needConfirmation: boolean;
  showTags: boolean;
  totalValues: null | number;
  savedQuery?: SavedQuery;
};
const SHOW_TAGS_STORAGE_KEY = 'discover2:show-tags';

function readShowTagsState() {
  const value = localStorage.getItem(SHOW_TAGS_STORAGE_KEY);
  return value === '1';
}

function getYAxis(location: Location, eventView: EventView, savedQuery?: SavedQuery) {
  return location.query.yAxis
    ? decodeList(location.query.yAxis)
    : savedQuery?.yAxis && savedQuery.yAxis.length > 0
    ? decodeList(savedQuery?.yAxis)
    : [eventView.getYAxis()];
}

class Results extends React.Component<Props, State> {
  static getDerivedStateFromProps(nextProps: Readonly<Props>, prevState: State): State {
    if (nextProps.savedQuery || !nextProps.loading) {
      const eventView = EventView.fromSavedQueryOrLocation(
        nextProps.savedQuery,
        nextProps.location
      );
      return {...prevState, eventView, savedQuery: nextProps.savedQuery};
    }
    return prevState;
  }

  state: State = {
    eventView: EventView.fromSavedQueryOrLocation(
      this.props.savedQuery,
      this.props.location
    ),
    error: '',
    errorCode: 200,
    totalValues: null,
    showTags: readShowTagsState(),
    needConfirmation: false,
    confirmedQuery: false,
    incompatibleAlertNotice: null,
  };

  componentDidMount() {
    const {organization, selection, location} = this.props;
    loadOrganizationTags(this.tagsApi, organization.slug, selection);
    addRoutePerformanceContext(selection);
    this.checkEventView();
    this.canLoadEvents();
    if (defined(location.query.id)) {
      updateSavedQueryVisit(organization.slug, location.query.id);
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const {api, location, organization, selection} = this.props;
    const {eventView, confirmedQuery, savedQuery} = this.state;

    this.checkEventView();
    const currentQuery = eventView.getEventsAPIPayload(location);
    const prevQuery = prevState.eventView.getEventsAPIPayload(prevProps.location);
    const yAxisArray = getYAxis(location, eventView, savedQuery);
    const prevYAxisArray = getYAxis(
      prevProps.location,
      prevState.eventView,
      prevState.savedQuery
    );

    if (
      !isAPIPayloadSimilar(currentQuery, prevQuery) ||
      this.hasChartParametersChanged(
        prevState.eventView,
        eventView,
        prevYAxisArray,
        yAxisArray
      )
    ) {
      api.clear();
      this.canLoadEvents();
    }
    if (
      !isEqual(prevProps.selection.datetime, selection.datetime) ||
      !isEqual(prevProps.selection.projects, selection.projects)
    ) {
      loadOrganizationTags(this.tagsApi, organization.slug, selection);
      addRoutePerformanceContext(selection);
    }

    if (prevState.confirmedQuery !== confirmedQuery) {
      this.fetchTotalCount();
    }
  }

  tagsApi: Client = new Client();

  hasChartParametersChanged(
    prevEventView: EventView,
    eventView: EventView,
    prevYAxisArray: string[],
    yAxisArray: string[]
  ) {
    if (!isEqual(prevYAxisArray, yAxisArray)) {
      return true;
    }

    const prevDisplay = prevEventView.getDisplayMode();
    const display = eventView.getDisplayMode();

    return prevDisplay !== display;
  }

  canLoadEvents = async () => {
    const {api, location, organization} = this.props;
    const {eventView} = this.state;
    let needConfirmation = false;
    let confirmedQuery = true;
    const currentQuery = eventView.getEventsAPIPayload(location);
    const duration = eventView.getDays();

    if (duration > 30 && currentQuery.project) {
      let projectLength = currentQuery.project.length;

      if (
        projectLength === 0 ||
        (projectLength === 1 && currentQuery.project[0] === '-1')
      ) {
        try {
          const results = await fetchProjectsCount(api, organization.slug);

          if (projectLength === 0) {
            projectLength = results.myProjects;
          } else {
            projectLength = results.allProjects;
          }
        } catch (err) {
          // do nothing, so the length is 0 or 1 and the query is assumed safe
        }
      }

      if (projectLength > 10) {
        needConfirmation = true;
        confirmedQuery = false;
      }
    }
    // Once confirmed, a change of project or datetime will happen before this can set it to false,
    // this means a query will still happen even if the new conditions need confirmation
    // using a state callback to return this to false
    this.setState({needConfirmation, confirmedQuery}, () => {
      this.setState({confirmedQuery: false});
    });
    if (needConfirmation) {
      this.openConfirm();
    }
  };

  openConfirm = () => {};

  setOpenFunction = ({open}) => {
    this.openConfirm = open;
    return null;
  };

  handleConfirmed = async () => {
    this.setState({needConfirmation: false, confirmedQuery: true}, () => {
      this.setState({confirmedQuery: false});
    });
  };

  handleCancelled = () => {
    this.setState({needConfirmation: false, confirmedQuery: false});
  };

  async fetchTotalCount() {
    const {api, organization, location} = this.props;
    const {eventView, confirmedQuery} = this.state;

    if (confirmedQuery === false || !eventView.isValid()) {
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
    const {loading} = this.props;
    if (eventView.isValid() || loading) {
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
    if (location.query?.query) {
      nextEventView.query = decodeScalar(location.query.query, '');
    }

    browserHistory.replace(nextEventView.getResultsViewUrlTarget(organization.slug));
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

    const queryParams = normalizeDateTimeParams({
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

  handleYAxisChange = (value: string[]) => {
    const {router, location} = this.props;
    const isDisplayMultiYAxisSupported = MULTI_Y_AXIS_SUPPORTED_DISPLAY_MODES.includes(
      location.query.display as DisplayModes
    );

    const newQuery = {
      ...location.query,
      yAxis: value,
      // If using Multi Y-axis and not in a supported display, change to the default display mode
      display:
        value.length > 1 && !isDisplayMultiYAxisSupported
          ? location.query.display === DisplayModes.DAILYTOP5
            ? DisplayModes.DAILY
            : DisplayModes.DEFAULT
          : location.query.display,
    };

    router.push({
      pathname: location.pathname,
      query: newQuery,
    });

    // Treat axis changing like the user already confirmed the query
    if (!this.state.needConfirmation) {
      this.handleConfirmed();
    }

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

    // Treat display changing like the user already confirmed the query
    if (!this.state.needConfirmation) {
      this.handleConfirmed();
    }
  };

  handleTopEventsChange = (value: string) => {
    const {router, location} = this.props;

    const newQuery = {
      ...location.query,
      topEvents: value,
    };

    router.push({
      pathname: location.pathname,
      query: newQuery,
    });

    // Treat display changing like the user already confirmed the query
    if (!this.state.needConfirmation) {
      this.handleConfirmed();
    }
  };

  getDocumentTitle(): string {
    const {organization} = this.props;
    const {eventView} = this.state;
    if (!eventView) {
      return '';
    }
    return generateTitle({eventView, organization});
  }

  renderTagsTable() {
    const {organization, location} = this.props;
    const {eventView, totalValues, confirmedQuery} = this.state;

    return (
      <Layout.Side>
        <Tags
          generateUrl={this.generateTagUrl}
          totalValues={totalValues}
          eventView={eventView}
          organization={organization}
          location={location}
          confirmedQuery={confirmedQuery}
        />
      </Layout.Side>
    );
  }

  generateTagUrl = (key: string, value: string) => {
    const {organization} = this.props;
    const {eventView} = this.state;

    const url = eventView.getResultsViewUrlTarget(organization.slug);
    url.query = generateQueryWithTag(url.query, {
      key: formatTagKey(key),
      value,
    });
    return url;
  };

  handleIncompatibleQuery: React.ComponentProps<
    typeof CreateAlertFromViewButton
  >['onIncompatibleQuery'] = (incompatibleAlertNoticeFn, errors) => {
    const {organization} = this.props;
    const {eventView} = this.state;
    trackAnalyticsEvent({
      eventKey: 'discover_v2.create_alert_clicked',
      eventName: 'Discoverv2: Create alert clicked',
      status: 'error',
      query: eventView.query,
      errors,
      organization_id: organization.id,
      url: window.location.href,
    });

    const incompatibleAlertNotice = incompatibleAlertNoticeFn(() =>
      this.setState({incompatibleAlertNotice: null})
    );

    this.setState({incompatibleAlertNotice});
  };

  renderError(error: string) {
    if (!error) {
      return null;
    }
    return (
      <Alert type="error" icon={<IconFlag size="md" />}>
        {error}
      </Alert>
    );
  }

  setError = (error: string, errorCode: number) => {
    this.setState({error, errorCode});
  };

  render() {
    const {organization, location, router} = this.props;
    const {
      eventView,
      error,
      errorCode,
      totalValues,
      showTags,
      incompatibleAlertNotice,
      confirmedQuery,
      savedQuery,
    } = this.state;
    const fields = eventView.hasAggregateField()
      ? generateAggregateFields(organization, eventView.fields)
      : eventView.fields;
    const query = eventView.query;
    const title = this.getDocumentTitle();
    const yAxisArray = getYAxis(location, eventView, savedQuery);

    return (
      <SentryDocumentTitle title={title} orgSlug={organization.slug}>
        <StyledPageContent>
          <NoProjectMessage organization={organization}>
            <ResultsHeader
              errorCode={errorCode}
              organization={organization}
              location={location}
              eventView={eventView}
              onIncompatibleAlertQuery={this.handleIncompatibleQuery}
              yAxis={yAxisArray}
              router={router}
            />
            <Layout.Body>
              {incompatibleAlertNotice && <Top fullWidth>{incompatibleAlertNotice}</Top>}
              <Top fullWidth>
                {this.renderError(error)}
                <StyledSearchBar
                  searchSource="eventsv2"
                  organization={organization}
                  projectIds={eventView.project}
                  query={query}
                  fields={fields}
                  onSearch={this.handleSearch}
                  maxQueryLength={MAX_QUERY_LENGTH}
                />
                <ResultsChart
                  router={router}
                  organization={organization}
                  eventView={eventView}
                  location={location}
                  onAxisChange={this.handleYAxisChange}
                  onDisplayChange={this.handleDisplayChange}
                  onTopEventsChange={this.handleTopEventsChange}
                  total={totalValues}
                  confirmedQuery={confirmedQuery}
                  yAxis={yAxisArray}
                />
              </Top>
              <Layout.Main fullWidth={!showTags}>
                <Table
                  organization={organization}
                  eventView={eventView}
                  location={location}
                  title={title}
                  setError={this.setError}
                  onChangeShowTags={this.handleChangeShowTags}
                  showTags={showTags}
                  confirmedQuery={confirmedQuery}
                />
              </Layout.Main>
              {showTags ? this.renderTagsTable() : null}
              <Confirm
                priority="primary"
                header={<strong>{t('May lead to thumb twiddling')}</strong>}
                confirmText={t('Do it')}
                cancelText={t('Nevermind')}
                onConfirm={this.handleConfirmed}
                onCancel={this.handleCancelled}
                message={
                  <p>
                    {tct(
                      `You've created a query that will search for events made
                      [dayLimit:over more than 30 days] for [projectLimit:more than 10 projects].
                      A lot has happened during that time, so this might take awhile.
                      Are you sure you want to do this?`,
                      {
                        dayLimit: <strong />,
                        projectLimit: <strong />,
                      }
                    )}
                  </p>
                }
              >
                {this.setOpenFunction}
              </Confirm>
            </Layout.Body>
          </NoProjectMessage>
        </StyledPageContent>
      </SentryDocumentTitle>
    );
  }
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(2)};
`;

const Top = styled(Layout.Main)`
  flex-grow: 0;
`;

type SavedQueryState = AsyncComponent['state'] & {
  savedQuery?: SavedQuery | null;
};

class SavedQueryAPI extends AsyncComponent<Props, SavedQueryState> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, location} = this.props;
    if (location.query.id) {
      return [
        [
          'savedQuery',
          `/organizations/${organization.slug}/discover/saved/${location.query.id}/`,
        ],
      ];
    }
    return [];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody(): React.ReactNode {
    const {savedQuery, loading} = this.state;
    return (
      <Results {...this.props} savedQuery={savedQuery ?? undefined} loading={loading} />
    );
  }
}

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
    <PageFiltersContainer
      skipLoadLastUsed={props.organization.features.includes('global-views')}
    >
      <SavedQueryAPI {...props} />
    </PageFiltersContainer>
  );
}

export default withApi(withOrganization(withPageFilters(ResultsContainer)));
