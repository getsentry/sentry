import {Component, Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {useQueryClient} from '@tanstack/react-query';
import type {Location} from 'history';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import type {CursorHandler} from '@sentry/scraps/pagination';
import {Tooltip} from '@sentry/scraps/tooltip';

import {updateSavedQueryVisit} from 'sentry/actionCreators/discoverSavedQueries';
import {fetchTotalCount} from 'sentry/actionCreators/events';
import {fetchProjectsCount} from 'sentry/actionCreators/projects';
import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import {GuideAnchor} from 'sentry/components/assistant/guideAnchor';
import {Banner} from 'sentry/components/banner';
import {Confirm} from 'sentry/components/confirm';
import {CreateAlertFromViewButton} from 'sentry/components/createAlertButton';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {
  normalizeDateTimeParams,
  normalizeDateTimeString,
} from 'sentry/components/pageFilters/parse';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {
  AiQueryProvider,
  useAiQueryContext,
} from 'sentry/components/searchQueryBuilder/askSeerCombobox/aiQueryContext';
import {trackAiQueryOutcome} from 'sentry/components/searchQueryBuilder/askSeerCombobox/utils';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconEllipsis} from 'sentry/icons';
import {IconClose} from 'sentry/icons/iconClose';
import {t, tct, tctCode} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {SavedSearchType} from 'sentry/types/group';
import type {NewQuery, Organization, SavedQuery} from 'sentry/types/organization';
import {defined, generateQueryWithTag} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {browserHistory} from 'sentry/utils/browserHistory';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {CustomMeasurementsContext} from 'sentry/utils/customMeasurements/customMeasurementsContext';
import {CustomMeasurementsProvider} from 'sentry/utils/customMeasurements/customMeasurementsProvider';
import {EventView, isAPIPayloadSimilar} from 'sentry/utils/discover/eventView';
import {formatTagKey, generateAggregateFields} from 'sentry/utils/discover/fields';
import {
  DiscoverDatasets,
  DisplayModes,
  MULTI_Y_AXIS_SUPPORTED_DISPLAY_MODES,
  SavedQueryDatasets,
} from 'sentry/utils/discover/types';
import {getDiscoverQueriesUrl} from 'sentry/utils/discover/urls';
import {localStorageWrapper} from 'sentry/utils/localStorage';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {setApiQueryData, useApiQuery} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {DashboardWidgetSource} from 'sentry/views/dashboards/types';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {
  DEFAULT_EVENT_VIEW,
  DEFAULT_EVENT_VIEW_MAP,
} from 'sentry/views/discover/results/data';
import ResultsChart from 'sentry/views/discover/results/resultsChart';
import {ResultsHeaderWrapper as ResultsHeader} from 'sentry/views/discover/results/resultsHeader';
import {ResultsSearchQueryBuilder} from 'sentry/views/discover/results/resultsSearchQueryBuilder';
import {SampleDataAlert} from 'sentry/views/discover/results/sampleDataAlert';
import Tags from 'sentry/views/discover/results/tags';
import {IconUpdate, SaveAsDropdown} from 'sentry/views/discover/savedQuery';
import {
  getDatasetFromLocationOrSavedQueryDataset,
  getSavedQueryDataset,
  getSavedQueryWithDataset,
  getTransactionDeprecationMessage,
  handleCreateQuery as handleCreateSavedQuery,
  handleDeleteQuery as handleDeleteSavedQuery,
  handleResetHomepageQuery,
  handleUpdateHomepageQuery,
  handleUpdateQuery as handleUpdateSavedQuery,
} from 'sentry/views/discover/savedQuery/utils';
import Table from 'sentry/views/discover/table';
import {
  generateTitle,
  handleAddQueryToDashboard,
  SAVED_QUERY_DATASET_TO_WIDGET_TYPE,
} from 'sentry/views/discover/utils';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {deprecateTransactionAlerts} from 'sentry/views/insights/common/utils/hasEAPAlerts';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {addRoutePerformanceContext} from 'sentry/views/performance/utils';

type Props = {
  api: Client;
  loading: boolean;
  location: Location;
  navigate: ReturnType<typeof useNavigate>;
  organization: Organization;
  selection: PageFilters;
  setSavedQuery: (savedQuery?: SavedQuery) => void;
  getAiQueryRunId?: () => number | null;
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
  homepageQuery?: SavedQuery;
  savedQuery?: SavedQuery;
  savedQueryDataset?: SavedQueryDatasets;
  showForcedDatasetAlert?: boolean;
  showQueryIncompatibleWithDataset?: boolean;
  showTransactionsDeprecationAlert?: boolean;
  showUnparameterizedBanner?: boolean;
  splitDecision?: SavedQueryDatasets;
};
const SHOW_TAGS_STORAGE_KEY = 'discover2:show-tags';
const SHOW_UNPARAM_BANNER = 'showUnparameterizedBanner';

function readShowTagsState() {
  const value = localStorageWrapper.getItem(SHOW_TAGS_STORAGE_KEY);
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
    const savedQueryDataset = getSavedQueryDataset(
      nextProps.organization,
      nextProps.location,
      nextProps.savedQuery,
      undefined
    );
    const eventViewFromQuery = EventView.fromSavedQueryOrLocation(
      nextProps.savedQuery,
      nextProps.location
    );
    const eventView =
      hasDatasetSelector(nextProps.organization) && !eventViewFromQuery.dataset
        ? eventViewFromQuery.withDataset(
            getDatasetFromLocationOrSavedQueryDataset(undefined, savedQueryDataset)
          )
        : eventViewFromQuery;
    return {...prevState, eventView, savedQuery: nextProps.savedQuery, savedQueryDataset};
  }

  state: State = {
    eventView: EventView.fromSavedQueryOrLocation(
      this.props.savedQuery,
      this.props.location
    ),
    savedQueryDataset: getSavedQueryDataset(
      this.props.organization,
      this.props.location,
      this.props.savedQuery,
      undefined
    ),
    error: '',
    homepageQuery: undefined,
    errorCode: 200,
    totalValues: null,
    showTags: readShowTagsState(),
    needConfirmation: false,
    confirmedQuery: false,
    tips: [],
    showForcedDatasetAlert: true,
    showQueryIncompatibleWithDataset: false,
    showTransactionsDeprecationAlert: true,
  };

  componentDidMount() {
    const {organization, selection, location, isHomepage, navigate} = this.props;
    if (location.query[SHOW_UNPARAM_BANNER]) {
      this.setState({showUnparameterizedBanner: true});
      navigate(
        {
          ...location,
          query: {...location.query, [SHOW_UNPARAM_BANNER]: undefined},
        },
        {replace: true}
      );
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

    if (location.query.incompatible) {
      this.setState({showQueryIncompatibleWithDataset: true});
      this.props.navigate(
        {
          ...location,
          query: {...location.query, incompatible: undefined},
        },
        {replace: true}
      );
    }

    this.checkEventView();
    const currentQuery = eventView.getEventsAPIPayload(location);
    const prevQuery = prevState.eventView.getEventsAPIPayload(prevProps.location);
    const yAxisArray = getYAxis(location, eventView, savedQuery);
    const prevYAxisArray = getYAxis(prevProps.location, eventView, prevState.savedQuery);

    const savedQueryDataset =
      decodeScalar(location.query.queryDataset) ?? savedQuery?.queryDataset;
    const prevSavedQueryDataset =
      decodeScalar(prevProps.location.query.queryDataset) ??
      prevState.savedQuery?.queryDataset;

    const datasetChanged = !isEqual(savedQueryDataset, prevSavedQueryDataset);

    if (
      !isAPIPayloadSimilar(currentQuery, prevQuery) ||
      this.hasChartParametersChanged(
        prevState.eventView,
        eventView,
        prevYAxisArray,
        yAxisArray
      ) ||
      datasetChanged
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

  setOpenFunction = ({open}: any) => {
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
    const {api, organization, location, getAiQueryRunId} = this.props;
    const {eventView, confirmedQuery} = this.state;

    if (!confirmedQuery || !eventView.isValid()) {
      return;
    }

    try {
      const totals = await fetchTotalCount(
        api,
        organization.slug,
        eventView.getEventsAPIPayload(location)
      );
      this.setState({totalValues: totals});

      const aiQueryRunId = getAiQueryRunId?.() ?? null;
      if (aiQueryRunId !== null) {
        trackAiQueryOutcome({
          dataset: 'errors',
          mode: eventView.hasAggregateField() ? 'aggregate' : 'samples',
          referrer: 'errors',
          resultCount: totals,
          orgSlug: organization.slug,
          runId: aiQueryRunId,
        });
      }
    } catch (err) {
      Sentry.captureException(err);
    }
  }

  checkEventView() {
    const {eventView, splitDecision, savedQueryDataset} = this.state;
    const {loading} = this.props;
    if (eventView.isValid() || loading) {
      return;
    }

    // If the view is not valid, redirect to a known valid state.
    const {location, organization, selection, isHomepage, savedQuery} = this.props;

    const value = getSavedQueryDataset(organization, location, savedQuery, splitDecision);
    const defaultEventView = hasDatasetSelector(organization)
      ? (getSavedQueryWithDataset(DEFAULT_EVENT_VIEW_MAP[value]) as NewQuery)
      : DEFAULT_EVENT_VIEW;

    const query = isHomepage && savedQuery ? omit(savedQuery, 'id') : defaultEventView;
    const nextEventView = EventView.fromNewQueryWithLocation(query, location);
    if (nextEventView.project.length === 0 && selection.projects) {
      nextEventView.project = selection.projects;
    }
    if (nextEventView.environment.length === 0 && selection.environments) {
      nextEventView.environment = selection.environments;
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
    this.props.navigate(
      normalizeUrl(
        nextEventView.getResultsViewUrlTarget(
          organization,
          isHomepage,
          hasDatasetSelector(organization) ? savedQueryDataset : undefined
        )
      ),
      {replace: true}
    );
  }

  handleCursor: CursorHandler = (cursor, path, query, _direction) => {
    this.props.navigate({
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
      localStorageWrapper.setItem(SHOW_TAGS_STORAGE_KEY, newValue ? '1' : '0');
      return {...state, showTags: newValue};
    });
  };

  handleSearch = (query: string) => {
    const {location, navigate} = this.props;

    const queryParams = normalizeDateTimeParams({
      ...location.query,
      query,
    });

    // do not propagate pagination when making a new search
    const searchQueryParams = omit(queryParams, 'cursor');

    navigate({
      pathname: location.pathname,
      query: searchQueryParams,
    });
  };

  handleYAxisChange = (value: string[]) => {
    const {navigate, location} = this.props;
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

    navigate({
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
    const {navigate, location} = this.props;

    const newQuery = {
      ...location.query,
      display: value,
    };

    navigate({
      pathname: location.pathname,
      query: newQuery,
    });

    // Treat display changing like the user already confirmed the query
    if (!this.state.needConfirmation) {
      this.handleConfirmed();
    }
  };

  handleIntervalChange = (value: string | undefined) => {
    const {navigate, location} = this.props;

    const newQuery = {
      ...location.query,
      interval: value,
    };

    if (location.query.interval !== value) {
      navigate({
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
    const {navigate, location} = this.props;

    const newQuery = {
      ...location.query,
      topEvents: value,
    };

    navigate({
      pathname: location.pathname,
      query: newQuery,
    });

    // Treat display changing like the user already confirmed the query
    if (!this.state.needConfirmation) {
      this.handleConfirmed();
    }
  };

  getDocumentTitle(): string {
    const {eventView} = this.state;
    const {isHomepage} = this.props;
    if (!eventView) {
      return '';
    }
    return generateTitle({eventView, isHomepage});
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
    const {eventView, savedQueryDataset} = this.state;

    const url = eventView.getResultsViewUrlTarget(
      organization,
      isHomepage,
      hasDatasetSelector(organization) ? savedQueryDataset : undefined
    );
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
      <Alert.Container>
        <Alert variant="danger">{error}</Alert>
      </Alert.Container>
    );
  }

  setError = (error: string, errorCode: number) => {
    this.setState({error, errorCode});
  };

  renderMetricsFallbackBanner() {
    if (this.state.showUnparameterizedBanner) {
      return (
        <Alert.Container>
          <Alert variant="info">
            {tct(
              'These are unparameterized transactions. To better organize your transactions, [link:set transaction names manually].',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/platforms/javascript/tracing/instrumentation/automatic-instrumentation/#beforenavigate" />
                ),
              }
            )}
          </Alert>
        </Alert.Container>
      );
    }
    return null;
  }

  renderQueryIncompatibleWithDatasetBanner() {
    const {organization} = this.props;
    if (hasDatasetSelector(organization) && this.state.showQueryIncompatibleWithDataset) {
      return (
        <Alert.Container>
          <Alert
            variant="warning"
            trailingItems={
              <StyledCloseButton
                icon={<IconClose size="sm" />}
                aria-label={t('Close')}
                onClick={() => {
                  this.setState({showQueryIncompatibleWithDataset: false});
                }}
                size="zero"
                variant="transparent"
              />
            }
          >
            {t('Your query was updated to make it compatible with this dataset.')}
          </Alert>
        </Alert.Container>
      );
    }
    return null;
  }

  renderTransactionsDatasetDeprecationBanner() {
    const {savedQueryDataset, savedQuery} = this.state;
    const {location, organization, selection} = this.props;
    const dataset = getDatasetFromLocationOrSavedQueryDataset(
      location,
      savedQueryDataset
    );

    if (dataset === DiscoverDatasets.TRANSACTIONS && savedQuery?.exploreQuery) {
      const exploreUrl = getExploreUrl({
        organization,
        ...savedQuery.exploreQuery?.query?.[0],
        field: savedQuery.exploreQuery?.query?.[0].fields,
        sort: savedQuery.exploreQuery?.query?.[0].orderby,
        groupBy: savedQuery.exploreQuery?.query?.[0].groupby,
        id: savedQuery.exploreQuery.id,
        title: savedQuery.exploreQuery.name,
        selection: {
          projects: savedQuery.exploreQuery.projects ?? selection.projects,
          environments: savedQuery.exploreQuery.environment ?? selection.environments,
          datetime: {
            start: savedQuery.exploreQuery.start ?? null,
            end: savedQuery.exploreQuery.end ?? null,
            period: savedQuery.exploreQuery.range ?? null,
            utc: selection.datetime.utc ?? null,
          },
        },
        interval: savedQuery.exploreQuery?.interval,
        referrer: 'discover_v2.transactions_query_migration_banner',
      });
      return (
        <Alert.Container>
          <Alert variant="warning">
            {tct(
              'This query has been migrated to Explore, the fancy new UI that will soon replace Discover. Try it out in [explore:Explore] instead.',
              {
                explore: <Link to={exploreUrl} />,
              }
            )}
          </Alert>
        </Alert.Container>
      );
    }

    if (
      this.state.showTransactionsDeprecationAlert &&
      organization.features.includes('performance-transaction-deprecation-banner') &&
      dataset === DiscoverDatasets.TRANSACTIONS
    ) {
      return (
        <Alert.Container>
          <Alert
            variant="warning"
            trailingItems={
              <StyledCloseButton
                icon={<IconClose size="sm" />}
                aria-label={t('Close')}
                onClick={() => {
                  this.setState({showTransactionsDeprecationAlert: false});
                }}
                size="zero"
                variant="transparent"
              />
            }
          >
            {tctCode(
              'The transactions dataset is being deprecated. Please use [traceLink:Explore / Traces] with the [code:is_transaction:true] filter instead. Please read these [FAQLink:FAQs] for more information.',
              {
                traceLink: <Link to="/explore/traces/?query=is_transaction:true" />,
                FAQLink: (
                  <ExternalLink href="https://www.sentry.help/en/articles/13964151-faq-transactions-spans-migration" />
                ),
              }
            )}
          </Alert>
        </Alert.Container>
      );
    }
    return null;
  }

  renderTips() {
    const {tips} = this.state;
    if (tips) {
      return tips.map((tip, index) => (
        <Alert.Container key={`tip-${index}`}>
          <Alert variant="info" key={`tip-${index}`}>
            <TipContainer as="span" text={tip} />
          </Alert>
        </Alert.Container>
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

  setSplitDecision = (value?: SavedQueryDatasets) => {
    const {eventView} = this.state;
    const newEventView = eventView.withDataset(
      getDatasetFromLocationOrSavedQueryDataset(undefined, value)
    );
    this.setState({
      splitDecision: value,
      savedQueryDataset: value,
      eventView: newEventView,
    });
  };

  renderSearchBar(customMeasurements: CustomMeasurementCollection | undefined) {
    const {organization} = this.props;
    const {eventView} = this.state;
    const fields = eventView.hasAggregateField()
      ? generateAggregateFields(organization, eventView.fields)
      : eventView.fields;

    let savedSearchType: SavedSearchType | undefined = SavedSearchType.EVENT;
    if (hasDatasetSelector(organization)) {
      savedSearchType =
        eventView.dataset === DiscoverDatasets.TRANSACTIONS
          ? SavedSearchType.TRANSACTION
          : SavedSearchType.ERROR;
    }

    return (
      <Wrapper>
        <ResultsSearchQueryBuilder
          projectIds={eventView.project}
          query={eventView.query}
          fields={fields}
          onSearch={this.handleSearch}
          customMeasurements={customMeasurements}
          dataset={eventView.dataset}
          includeTransactions
          recentSearches={savedSearchType}
        />
      </Wrapper>
    );
  }

  render() {
    const {organization, location, selection, api, setSavedQuery, isHomepage} =
      this.props;
    const {
      eventView,
      error,
      errorCode,
      totalValues,
      showTags,
      confirmedQuery,
      savedQuery,
      splitDecision,
      savedQueryDataset,
    } = this.state;
    const hasDatasetSelectorFeature = hasDatasetSelector(organization);

    const query = eventView.query;
    const title = this.getDocumentTitle();
    const yAxisArray = getYAxis(location, eventView, savedQuery);

    if (!eventView.isValid()) {
      return <LoadingIndicator />;
    }

    return (
      <SentryDocumentTitle title={title} orgSlug={organization.slug}>
        <Stack flex={1}>
          <ResultsHeader
            setSavedQuery={setSavedQuery}
            errorCode={errorCode}
            organization={organization}
            location={location}
            eventView={eventView}
            yAxis={yAxisArray}
            isHomepage={isHomepage}
            splitDecision={splitDecision}
          />
          <Layout.Body>
            <CustomMeasurementsProvider organization={organization} selection={selection}>
              <Top width="full">
                {this.renderMetricsFallbackBanner()}
                {this.renderError(error)}
                {this.renderTips()}
                {this.renderQueryIncompatibleWithDatasetBanner()}
                {this.renderTransactionsDatasetDeprecationBanner()}
                {!hasDatasetSelectorFeature && <SampleDataAlert query={query} />}

                <DiscoverPageFilters
                  eventView={eventView}
                  organization={organization}
                  location={location}
                  savedQuery={savedQuery}
                  yAxis={yAxisArray}
                  isHomepage={isHomepage}
                  setSavedQuery={setSavedQuery}
                  errorCode={errorCode}
                />
                <CustomMeasurementsContext.Consumer>
                  {contextValue =>
                    this.renderSearchBar(contextValue?.customMeasurements ?? undefined)
                  }
                </CustomMeasurementsContext.Consumer>
                <MetricsCardinalityProvider
                  organization={organization}
                  location={location}
                >
                  <ResultsChart
                    api={api}
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
              <Layout.Main width={showTags ? 'twothirds' : 'full'}>
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
                  queryDataset={savedQueryDataset}
                  setSplitDecision={(value?: SavedQueryDatasets) => {
                    if (
                      hasDatasetSelectorFeature &&
                      value !== SavedQueryDatasets.DISCOVER &&
                      value !== savedQuery?.dataset
                    ) {
                      this.setSplitDecision(value);
                    }
                  }}
                  dataset={hasDatasetSelectorFeature ? eventView.dataset : undefined}
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
        </Stack>
      </SentryDocumentTitle>
    );
  }
}

function DiscoverContextMenu({
  organization,
  eventView,
  location,
  savedQuery,
  yAxis,
  isHomepage,
  setSavedQuery,
}: {
  eventView: EventView;
  location: Location;
  organization: Organization;
  setSavedQuery: (savedQuery?: SavedQuery) => void;
  yAxis: string[];
  isHomepage?: boolean;
  savedQuery?: SavedQuery;
}) {
  const api = useApi();
  const queryClient = useQueryClient();

  const homepageQueryKey = useMemo(
    (): ApiQueryKey => [
      getApiUrl('/organizations/$organizationIdOrSlug/discover/homepage/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
    ],
    [organization.slug]
  );

  const hasDiscoverQueryFeature = organization.features.includes('discover-query');

  const {data: homepageQuery} = useApiQuery<SavedQuery | undefined>(homepageQueryKey, {
    staleTime: 0,
    enabled: hasDiscoverQueryFeature,
  });

  const normalizedHomepageQuery = homepageQuery
    ? getSavedQueryWithDataset(homepageQuery)!
    : undefined;

  const isDefault =
    normalizedHomepageQuery &&
    eventView.isEqualTo(EventView.fromSavedQuery(normalizedHomepageQuery), [
      'id',
      'name',
    ]);

  const analyticsEventSource = isHomepage
    ? 'homepage'
    : eventView.id
      ? 'saved-query'
      : 'prebuilt-query';

  const currentDataset = getDatasetFromLocationOrSavedQueryDataset(
    location,
    savedQuery?.queryDataset
  );
  const deprecatingTransactionsDataset =
    currentDataset === DiscoverDatasets.TRANSACTIONS &&
    organization.features.includes('discover-saved-queries-deprecation');

  const tracesUrl = getExploreUrl({organization, query: 'is_transaction:true'});

  const items: MenuItemProps[] = [];

  if (organization.features.includes('dashboards-edit')) {
    items.push({
      key: 'add-to-dashboard',
      label: t('Add to Dashboard'),
      disabled: deprecatingTransactionsDataset,
      tooltipOptions: {isHoverable: true},
      tooltip:
        deprecatingTransactionsDataset && getTransactionDeprecationMessage(tracesUrl),
      onAction: () => {
        handleAddQueryToDashboard({
          organization,
          location,
          eventView,
          query: savedQuery,
          yAxis,
          widgetType: hasDatasetSelector(organization)
            ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre...
              SAVED_QUERY_DATASET_TO_WIDGET_TYPE[
                getSavedQueryDataset(organization, location, savedQuery)
              ]
            : undefined,
          source: DashboardWidgetSource.DISCOVERV2,
        });
      },
    });
  }

  if (organization.features.includes('discover-query')) {
    if (isDefault) {
      items.push({
        key: 'remove-default',
        label: t('Remove Default'),
        onAction: async () => {
          await handleResetHomepageQuery(api, organization);
          trackAnalytics('discover_v2.remove_default', {
            organization,
            source: analyticsEventSource,
          });
          setApiQueryData(queryClient, homepageQueryKey, undefined);
          if (isHomepage) {
            setSavedQuery(undefined);
            const nextEventView = EventView.fromNewQueryWithLocation(
              DEFAULT_EVENT_VIEW,
              location
            );
            browserHistory.push({
              pathname: location.pathname,
              query: nextEventView.generateQueryStringObject(),
            });
          }
        },
      });
    } else {
      items.push({
        key: 'set-as-default',
        label: t('Set as Default'),
        onAction: async () => {
          const updatedHomepageQuery = await handleUpdateHomepageQuery(
            api,
            organization,
            eventView.toNewQuery()
          );
          trackAnalytics('discover_v2.set_as_default', {
            organization,
            source: analyticsEventSource,
          });
          if (updatedHomepageQuery) {
            setApiQueryData(queryClient, homepageQueryKey, updatedHomepageQuery);
            if (isHomepage) {
              setSavedQuery(updatedHomepageQuery);
            }
          }
        },
      });
    }
  }

  if (!isHomepage && savedQuery) {
    items.push({
      key: 'delete-saved-query',
      label: t('Delete Saved Query'),
      onAction: () => {
        handleDeleteSavedQuery(api, organization, eventView).then(() => {
          browserHistory.push(
            normalizeUrl({pathname: getDiscoverQueriesUrl(organization), query: {}})
          );
        });
      },
    });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <DropdownMenu
      items={items}
      trigger={triggerProps => (
        <Button
          {...triggerProps}
          aria-label={t('Discover Context Menu')}
          size="sm"
          onClick={e => {
            e.stopPropagation();
            e.preventDefault();
            triggerProps.onClick?.(e);
          }}
          icon={<IconEllipsis />}
        />
      )}
      position="bottom-end"
      offset={4}
    />
  );
}

function SaveQueryButton({
  eventView,
  organization,
  location,
  savedQuery,
  yAxis,
  setSavedQuery,
  errorCode,
}: {
  errorCode: number;
  eventView: EventView;
  location: Location;
  organization: Organization;
  setSavedQuery: (savedQuery?: SavedQuery) => void;
  yAxis: string[];
  savedQuery?: SavedQuery;
}) {
  const api = useApi();
  const [queryName, setQueryName] = useState('');

  const {isNewQuery, isEditingQuery} = useMemo(() => {
    if (!savedQuery) {
      return {isNewQuery: true, isEditingQuery: false};
    }
    const savedEventView = EventView.fromSavedQuery(savedQuery);
    if (savedEventView.id !== eventView.id) {
      return {isNewQuery: false, isEditingQuery: false};
    }
    const isEqualQuery = eventView.isEqualTo(savedEventView);
    const isEqualYAxis = isEqual(
      yAxis,
      savedQuery.yAxis
        ? typeof savedQuery.yAxis === 'string'
          ? [savedQuery.yAxis]
          : savedQuery.yAxis
        : ['count()']
    );
    return {isNewQuery: false, isEditingQuery: !isEqualQuery || !isEqualYAxis};
  }, [eventView, savedQuery, yAxis]);

  useEffect(() => {
    setQueryName('');
  }, [eventView.id]);

  const currentDataset = getDatasetFromLocationOrSavedQueryDataset(
    location,
    savedQuery?.queryDataset
  );
  const deprecatingTransactionsDataset =
    currentDataset === DiscoverDatasets.TRANSACTIONS &&
    organization.features.includes('discover-saved-queries-deprecation');
  const tracesUrl = getExploreUrl({organization, query: 'is_transaction:true'});

  const handleCreate = useCallback(
    (event: React.MouseEvent | React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!queryName) {
        return;
      }
      const nextEventView = eventView.clone();
      nextEventView.name = queryName;
      handleCreateSavedQuery(api, organization, nextEventView, yAxis, !eventView.id).then(
        (sq: SavedQuery) => {
          const view = EventView.fromSavedQuery(sq);
          Banner.dismiss('discover');
          setQueryName('');
          browserHistory.push(normalizeUrl(view.getResultsViewUrlTarget(organization)));
        }
      );
    },
    [api, organization, eventView, yAxis, queryName]
  );

  const handleUpdate = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    handleUpdateSavedQuery(api, organization, eventView, yAxis).then((sq: SavedQuery) => {
      const view = EventView.fromSavedQuery(sq);
      setSavedQuery(sq);
      setQueryName('');
      browserHistory.push(view.getResultsViewShortUrlTarget(organization));
    });
  };

  return (
    <Feature organization={organization} features="discover-query">
      {({hasFeature}) => {
        const disabled = !hasFeature || (errorCode >= 400 && errorCode < 500);

        if (!isNewQuery && !isEditingQuery) {
          return null;
        }

        if (!isNewQuery && isEditingQuery) {
          return (
            <Fragment>
              <Tooltip
                title={
                  deprecatingTransactionsDataset &&
                  getTransactionDeprecationMessage(tracesUrl)
                }
                isHoverable
              >
                <Button
                  onClick={handleUpdate}
                  data-test-id="discover2-savedquery-button-update"
                  disabled={disabled || deprecatingTransactionsDataset}
                  size="sm"
                >
                  <IconUpdate />
                  {t('Save Changes')}
                </Button>
              </Tooltip>
              <Tooltip
                disabled={
                  currentDataset !== DiscoverDatasets.TRANSACTIONS ||
                  !organization.features.includes('discover-saved-queries-deprecation')
                }
                isHoverable
                title={getTransactionDeprecationMessage(tracesUrl)}
              >
                <SaveAsDropdown
                  queryName={queryName}
                  onChangeInput={e => setQueryName(e.currentTarget.value)}
                  modifiedHandleCreateQuery={handleCreate}
                  disabled={disabled || deprecatingTransactionsDataset}
                />
              </Tooltip>
            </Fragment>
          );
        }

        return (
          <Tooltip
            disabled={
              currentDataset !== DiscoverDatasets.TRANSACTIONS ||
              !organization.features.includes('discover-saved-queries-deprecation')
            }
            isHoverable
            title={getTransactionDeprecationMessage(tracesUrl)}
          >
            <SaveAsDropdown
              queryName={queryName}
              onChangeInput={e => setQueryName(e.currentTarget.value)}
              modifiedHandleCreateQuery={handleCreate}
              disabled={disabled || deprecatingTransactionsDataset}
            />
          </Tooltip>
        );
      }}
    </Feature>
  );
}

function DiscoverPageFilters({
  eventView,
  organization,
  location,
  savedQuery,
  yAxis,
  isHomepage,
  setSavedQuery,
  errorCode,
}: {
  errorCode: number;
  eventView: EventView;
  location: Location;
  organization: Organization;
  savedQuery: SavedQuery | undefined;
  setSavedQuery: (savedQuery?: SavedQuery) => void;
  yAxis: string[];
  isHomepage?: boolean;
}) {
  const hasPageFrameFeature = useHasPageFrameFeature();
  const {projects} = useProjects();

  const currentDataset = getDatasetFromLocationOrSavedQueryDataset(
    location,
    savedQuery?.queryDataset
  );

  const shouldHideCreateAlert =
    currentDataset === DiscoverDatasets.TRANSACTIONS &&
    (deprecateTransactionAlerts(organization) ||
      organization.features.includes('discover-saved-queries-deprecation'));

  let alertType: any;
  let buttonEventView = eventView;
  if (hasDatasetSelector(organization)) {
    alertType = defined(currentDataset)
      ? // @ts-expect-error TS(2339): Property 'discover' does not exist on type '{ tran...
        {
          [DiscoverDatasets.TRANSACTIONS]: 'throughput',
          [DiscoverDatasets.ERRORS]: 'num_errors',
        }[currentDataset]
      : undefined;

    if (currentDataset === DiscoverDatasets.TRANSACTIONS) {
      buttonEventView = eventView.clone();
      buttonEventView.query = eventView.query
        ? `(${eventView.query}) AND (event.type:transaction)`
        : 'event.type:transaction';
    }
  }

  return (
    <Wrapper>
      <PageFilterBar condensed>
        <ProjectPageFilter />
        <EnvironmentPageFilter />
        <DatePageFilter />
      </PageFilterBar>
      {hasPageFrameFeature && (
        <Flex gap="md" align="center">
          {!shouldHideCreateAlert && (
            <Feature organization={organization} features="incidents">
              {({hasFeature}) =>
                hasFeature && (
                  <GuideAnchor target="create_alert_from_discover">
                    <CreateAlertFromViewButton
                      eventView={buttonEventView}
                      organization={organization}
                      projects={projects}
                      onClick={() => {
                        trackAnalytics('discover_v2.create_alert_clicked', {
                          organization,
                          status: 'success',
                        });
                      }}
                      referrer="discover"
                      size="sm"
                      data-test-id="discover2-create-from-discover"
                      alertType={alertType}
                    />
                  </GuideAnchor>
                )
              }
            </Feature>
          )}
          <DiscoverContextMenu
            organization={organization}
            eventView={eventView}
            location={location}
            savedQuery={savedQuery}
            yAxis={yAxis}
            isHomepage={isHomepage}
            setSavedQuery={setSavedQuery}
          />
          <SaveQueryButton
            eventView={eventView}
            organization={organization}
            location={location}
            savedQuery={savedQuery}
            yAxis={yAxis}
            setSavedQuery={setSavedQuery}
            errorCode={errorCode}
          />
        </Flex>
      )}
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space.xl};

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    flex-direction: column;
  }
`;

const Top = styled(Layout.Main)`
  flex-grow: 0;
`;

const TipContainer = styled(MarkedText)`
  > p {
    margin: 0;
  }
`;

function SavedQueryAPI(props: Omit<Props, 'savedQuery' | 'loading' | 'setSavedQuery'>) {
  const queryClient = useQueryClient();
  const {organization, location} = props;
  const {getRunIdForAnalytics} = useAiQueryContext();

  const queryKey = useMemo(
    (): ApiQueryKey => [
      getApiUrl('/organizations/$organizationIdOrSlug/discover/saved/$queryId/', {
        path: {
          organizationIdOrSlug: organization.slug,
          queryId: decodeScalar(location.query.id)!,
        },
      }),
    ],
    [organization, location.query.id]
  );
  const {data, isError, isFetching, refetch} = useApiQuery<SavedQuery | undefined>(
    queryKey,
    {
      enabled: Boolean(location.query.id),
      staleTime: 0,
    }
  );

  const setSavedQuery = useCallback(
    (newQuery?: SavedQuery) => {
      setApiQueryData(queryClient, queryKey, newQuery);
      queryClient.refetchQueries({queryKey});
    },
    [queryClient, queryKey]
  );

  if (isFetching) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError message={t('Failed to load saved query')} onRetry={refetch} />;
  }

  return (
    <Results
      {...props}
      getAiQueryRunId={getRunIdForAnalytics}
      savedQuery={
        hasDatasetSelector(organization) ? getSavedQueryWithDataset(data) : data
      }
      loading={isFetching}
      setSavedQuery={setSavedQuery}
    />
  );
}

export default function ResultsContainer() {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const location = useLocation();
  const navigate = useNavigate();

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
        organization.features.includes('discover-query') && !!location.query.id
      }
      skipLoadLastUsed={false}
      // The Discover Results component will manage URL params, including page filters state
      // This avoids an unnecessary re-render when forcing a project filter for team plan users
      skipInitializeUrlParams
    >
      <AiQueryProvider>
        <SavedQueryAPI
          api={api}
          organization={organization}
          selection={selection}
          location={location}
          navigate={navigate}
        />
      </AiQueryProvider>
    </PageFiltersContainer>
  );
}

const StyledCloseButton = styled(Button)`
  background-color: transparent;
  transition: opacity 0.1s linear;

  &:hover,
  &:focus {
    background-color: transparent;
    opacity: 1;
  }
`;
