import {Component, Fragment} from 'react';
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
import {Alert} from 'sentry/components/alert';
import Confirm from 'sentry/components/confirm';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import SearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {
  normalizeDateTimeParams,
  normalizeDateTimeString,
} from 'sentry/components/organizations/pageFilters/parse';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {CursorHandler} from 'sentry/components/pagination';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, PageFilters, SavedQuery} from 'sentry/types';
import {defined, generateQueryWithTag} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {CustomMeasurementsContext} from 'sentry/utils/customMeasurements/customMeasurementsContext';
import {CustomMeasurementsProvider} from 'sentry/utils/customMeasurements/customMeasurementsProvider';
import EventView, {isAPIPayloadSimilar} from 'sentry/utils/discover/eventView';
import {formatTagKey, generateAggregateFields} from 'sentry/utils/discover/fields';
import {
  DisplayModes,
  MULTI_Y_AXIS_SUPPORTED_DISPLAY_MODES,
} from 'sentry/utils/discover/types';
import localStorage from 'sentry/utils/localStorage';
import marked from 'sentry/utils/marked';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import withApi from 'sentry/utils/withApi';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';

import {addRoutePerformanceContext} from '../performance/utils';

import {DEFAULT_EVENT_VIEW} from './data';
import ResultsChart from './resultsChart';
import ResultsHeader from './resultsHeader';
import {SampleDataAlert} from './sampleDataAlert';
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
  setSavedQuery: (savedQuery?: SavedQuery) => void;
  isHomepage?: boolean;
  savedQuery?: SavedQuery;
};

type State = {
  confirmedQuery: boolean;
  error: string;
  errorCode: number;
  eventView: EventView;
  needConfirmation: boolean;
  showTags: boolean;
  tips: string[];
  totalValues: null | number;
  savedQuery?: SavedQuery;
  showMetricsAlert?: boolean;
  showUnparameterizedBanner?: boolean;
};
const SHOW_TAGS_STORAGE_KEY = 'discover2:show-tags';
const SHOW_UNPARAM_BANNER = 'showUnparameterizedBanner';

function readShowTagsState() {
  const value = localStorage.getItem(SHOW_TAGS_STORAGE_KEY);
  return value === '1';
}

function getYAxis(location: Location, eventView: EventView, savedQuery?: SavedQuery) {
  if (location.query.yAxis) {
    return decodeList(location.query.yAxis);
  }
  if (location.query.yAxis === null) {
    return [];
  }
  return savedQuery?.yAxis && savedQuery?.yAxis.length > 0
    ? decodeList(savedQuery?.yAxis)
    : [eventView.getYAxis()];
}

export class Results extends Component<Props, State> {
  static getDerivedStateFromProps(nextProps: Readonly<Props>, prevState: State): State {
    const eventView = EventView.fromSavedQueryOrLocation(
      nextProps.savedQuery,
      nextProps.location
    );
    return {...prevState, eventView, savedQuery: nextProps.savedQuery};
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
    tips: [],
  };

  componentDidMount() {
    const {organization, selection, location, isHomepage} = this.props;
    if (location.query.fromMetric) {
      this.setState({showMetricsAlert: true});
      browserHistory.replace({
        ...location,
        query: {...location.query, fromMetric: undefined},
      });
    }
    if (location.query[SHOW_UNPARAM_BANNER]) {
      this.setState({showUnparameterizedBanner: true});
      browserHistory.replace({
        ...location,
        query: {...location.query, [SHOW_UNPARAM_BANNER]: undefined},
      });
    }
    loadOrganizationTags(this.tagsApi, organization.slug, selection);
    addRoutePerformanceContext(selection);
    this.checkEventView();
    this.canLoadEvents();
    if (!isHomepage && defined(location.query.id)) {
      updateSavedQueryVisit(organization.slug, location.query.id);
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const {location, organization, selection} = this.props;
    const {eventView, confirmedQuery, savedQuery} = this.state;

    this.checkEventView();
    const currentQuery = eventView.getEventsAPIPayload(location);
    const prevQuery = prevState.eventView.getEventsAPIPayload(prevProps.location);
    const yAxisArray = getYAxis(location, eventView, savedQuery);
    const prevYAxisArray = getYAxis(prevProps.location, eventView, prevState.savedQuery);

    if (
      !isAPIPayloadSimilar(currentQuery, prevQuery) ||
      this.hasChartParametersChanged(
        prevState.eventView,
        eventView,
        prevYAxisArray,
        yAxisArray
      )
    ) {
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

  handleConfirmed = () => {
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
    const {location, organization, selection, isHomepage, savedQuery} = this.props;
    const isReplayEnabled = organization.features.includes('session-replay');
    const defaultEventView = Object.assign({}, DEFAULT_EVENT_VIEW, {
      fields: isReplayEnabled
        ? DEFAULT_EVENT_VIEW.fields.concat(['replayId'])
        : DEFAULT_EVENT_VIEW.fields,
    });

    const query = isHomepage && savedQuery ? omit(savedQuery, 'id') : defaultEventView;
    const nextEventView = EventView.fromNewQueryWithLocation(query, location);
    if (nextEventView.project.length === 0 && selection.projects) {
      nextEventView.project = selection.projects;
    }
    if (selection.datetime) {
      const {period, utc, start, end} = selection.datetime;
      nextEventView.statsPeriod = period ?? undefined;
      nextEventView.utc = utc?.toString();
      nextEventView.start = normalizeDateTimeString(start);
      nextEventView.end = normalizeDateTimeString(end);
    }
    if (location.query?.query) {
      nextEventView.query = decodeScalar(location.query.query, '');
    }

    if (isHomepage && !this.state.savedQuery) {
      this.setState({savedQuery, eventView: nextEventView});
    }
    browserHistory.replace(
      normalizeUrl(nextEventView.getResultsViewUrlTarget(organization.slug, isHomepage))
    );
  }

  handleCursor: CursorHandler = (cursor, path, query, _direction) => {
    const {router} = this.props;
    router.push({
      pathname: path,
      query: {...query, cursor},
    });
    // Treat pagination like the user already confirmed the query
    if (!this.state.needConfirmation) {
      this.handleConfirmed();
    }
  };

  handleChangeShowTags = () => {
    const {organization} = this.props;
    trackAnalytics('discover_v2.results.toggle_tag_facets', {
      organization,
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
      yAxis: value.length > 0 ? value : [null],
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

    trackAnalytics('discover_v2.y_axis_change', {
      organization: this.props.organization,
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

  handleIntervalChange = (value: string | undefined) => {
    const {router, location} = this.props;

    const newQuery = {
      ...location.query,
      interval: value,
    };

    if (location.query.interval !== value) {
      router.push({
        pathname: location.pathname,
        query: newQuery,
      });

      // Treat display changing like the user already confirmed the query
      if (!this.state.needConfirmation) {
        this.handleConfirmed();
      }
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
    const {organization, isHomepage} = this.props;
    const {eventView} = this.state;

    const url = eventView.getResultsViewUrlTarget(organization.slug, isHomepage);
    url.query = generateQueryWithTag(url.query, {
      key: formatTagKey(key),
      value,
    });
    return url;
  };

  renderError(error: string) {
    if (!error) {
      return null;
    }
    return (
      <Alert type="error" showIcon>
        {error}
      </Alert>
    );
  }

  setError = (error: string, errorCode: number) => {
    this.setState({error, errorCode});
  };

  renderMetricsFallbackBanner() {
    const {organization} = this.props;
    if (
      !organization.features.includes('performance-mep-bannerless-ui') &&
      this.state.showMetricsAlert
    ) {
      return (
        <Alert type="info" showIcon>
          {t(
            "You've navigated to this page from a performance metric widget generated from processed events. The results here only show indexed events."
          )}
        </Alert>
      );
    }
    if (this.state.showUnparameterizedBanner) {
      return (
        <Alert type="info" showIcon>
          {tct(
            'These are unparameterized transactions. To better organize your transactions, [link:set transaction names manually].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/performance/instrumentation/automatic-instrumentation/#beforenavigate" />
              ),
            }
          )}
        </Alert>
      );
    }
    return null;
  }

  renderTips() {
    const {tips} = this.state;
    if (tips) {
      return tips.map((tip, index) => (
        <Alert type="info" showIcon key={`tip-${index}`}>
          <TipContainer dangerouslySetInnerHTML={{__html: marked(tip)}} />
        </Alert>
      ));
    }
    return null;
  }

  setTips = (tips: string[]) => {
    // If there are currently no tips set and the new tips are empty, do nothing
    // and bail out of an expensive entire table rerender
    if (!tips.length && !this.state.tips.length) {
      return;
    }
    this.setState({tips});
  };

  render() {
    const {organization, location, router, selection, api, setSavedQuery, isHomepage} =
      this.props;
    const {
      eventView,
      error,
      errorCode,
      totalValues,
      showTags,
      confirmedQuery,
      savedQuery,
    } = this.state;
    const fields = eventView.hasAggregateField()
      ? generateAggregateFields(organization, eventView.fields)
      : eventView.fields;
    const query = eventView.query;
    const title = this.getDocumentTitle();
    const yAxisArray = getYAxis(location, eventView, savedQuery);

    if (!eventView.isValid()) {
      return <LoadingIndicator />;
    }

    return (
      <SentryDocumentTitle title={title} orgSlug={organization.slug}>
        <Fragment>
          <ResultsHeader
            setSavedQuery={setSavedQuery}
            errorCode={errorCode}
            organization={organization}
            location={location}
            eventView={eventView}
            yAxis={yAxisArray}
            router={router}
            isHomepage={isHomepage}
          />
          <Layout.Body>
            <CustomMeasurementsProvider organization={organization} selection={selection}>
              <Top fullWidth>
                {this.renderMetricsFallbackBanner()}
                {this.renderError(error)}
                {this.renderTips()}
                <StyledPageFilterBar condensed>
                  <ProjectPageFilter />
                  <EnvironmentPageFilter />
                  <DatePageFilter />
                </StyledPageFilterBar>
                <CustomMeasurementsContext.Consumer>
                  {contextValue => (
                    <StyledSearchBar
                      searchSource="eventsv2"
                      organization={organization}
                      projectIds={eventView.project}
                      query={query}
                      fields={fields}
                      onSearch={this.handleSearch}
                      maxQueryLength={MAX_QUERY_LENGTH}
                      customMeasurements={contextValue?.customMeasurements ?? undefined}
                    />
                  )}
                </CustomMeasurementsContext.Consumer>
                <SampleDataAlert query={query} />
                <MetricsCardinalityProvider
                  organization={organization}
                  location={location}
                >
                  <ResultsChart
                    api={api}
                    router={router}
                    organization={organization}
                    eventView={eventView}
                    location={location}
                    onAxisChange={this.handleYAxisChange}
                    onDisplayChange={this.handleDisplayChange}
                    onTopEventsChange={this.handleTopEventsChange}
                    onIntervalChange={this.handleIntervalChange}
                    total={totalValues}
                    confirmedQuery={confirmedQuery}
                    yAxis={yAxisArray}
                  />
                </MetricsCardinalityProvider>
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
                  onCursor={this.handleCursor}
                  isHomepage={isHomepage}
                  setTips={this.setTips}
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
            </CustomMeasurementsProvider>
          </Layout.Body>
        </Fragment>
      </SentryDocumentTitle>
    );
  }
}

const StyledPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(1)};
`;

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(2)};
`;

const Top = styled(Layout.Main)`
  flex-grow: 0;
`;

const TipContainer = styled('span')`
  > p {
    margin: 0;
  }
`;

type SavedQueryState = DeprecatedAsyncComponent['state'] & {
  savedQuery?: SavedQuery | null;
};

class SavedQueryAPI extends DeprecatedAsyncComponent<Props, SavedQueryState> {
  shouldReload = true;

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization, location} = this.props;

    const endpoints: ReturnType<DeprecatedAsyncComponent['getEndpoints']> = [];
    if (location.query.id) {
      endpoints.push([
        'savedQuery',
        `/organizations/${organization.slug}/discover/saved/${location.query.id}/`,
      ]);
      return endpoints;
    }
    return endpoints;
  }

  setSavedQuery = (newSavedQuery?: SavedQuery) => {
    this.setState({savedQuery: newSavedQuery});
  };

  renderBody(): React.ReactNode {
    const {savedQuery, loading} = this.state;
    return (
      <Results
        {...this.props}
        savedQuery={savedQuery ?? undefined}
        loading={loading}
        setSavedQuery={this.setSavedQuery}
      />
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
   * the desired behavior because saved queries can contain a project filter. The only
   * exception is if we are showing a prebuilt saved query in which case we want to
   * respect pinned filters.
   */

  return (
    <PageFiltersContainer
      disablePersistence={
        props.organization.features.includes('discover-query') &&
        !!(props.savedQuery || props.location.query.id)
      }
      skipLoadLastUsed={
        props.organization.features.includes('global-views') && !!props.savedQuery
      }
    >
      <SavedQueryAPI {...props} />
    </PageFiltersContainer>
  );
}

export default withApi(withOrganization(withPageFilters(ResultsContainer)));
