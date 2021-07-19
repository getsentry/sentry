import {Component} from 'react';
import {browserHistory, WithRouterProps} from 'react-router';
import {Location} from 'history';

import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {GlobalSelection, Organization, Project} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {
  isAggregateField,
  QueryFieldValue,
  SPAN_OP_BREAKDOWN_FIELDS,
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
  WebVital,
} from 'app/utils/discover/fields';
import {removeHistogramQueryStrings} from 'app/utils/performance/histogram';
import {decodeScalar} from 'app/utils/queryString';
import {tokenizeSearch} from 'app/utils/tokenizeSearch';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

import {getTransactionName} from '../../utils';
import {
  decodeFilterFromLocation,
  filterToLocationQuery,
  SpanOperationBreakdownFilter,
} from '../filter';
import {ZOOM_END, ZOOM_START} from '../latencyChart';

import EventsPageContent from './content';
import {
  decodeEventsDisplayFilterFromLocation,
  EventsDisplayFilterName,
  EventsFilterPercentileValues,
  filterEventsDisplayToLocationQuery,
  getEventsFilterOptions,
} from './utils';

type Props = {
  location: Location;
  organization: Organization;
  projects: Project[];
  selection: GlobalSelection;
} & Pick<WithRouterProps, 'router'>;

type State = {
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter;
  eventsDisplayFilterName: EventsDisplayFilterName;
  eventView?: EventView;
};

type PercentileValues = Record<EventsDisplayFilterName, number>;
class TransactionEvents extends Component<Props, State> {
  state: State = {
    spanOperationBreakdownFilter: decodeFilterFromLocation(this.props.location),
    eventsDisplayFilterName: decodeEventsDisplayFilterFromLocation(this.props.location),
    eventView: generateEventsEventView(
      this.props.location,
      getTransactionName(this.props.location)
    ),
  };

  static getDerivedStateFromProps(nextProps: Readonly<Props>, prevState: State): State {
    return {
      ...prevState,
      spanOperationBreakdownFilter: decodeFilterFromLocation(nextProps.location),
      eventsDisplayFilterName: decodeEventsDisplayFilterFromLocation(nextProps.location),
      eventView: generateEventsEventView(
        nextProps.location,
        getTransactionName(nextProps.location)
      ),
    };
  }

  onChangeSpanOperationBreakdownFilter = (newFilter: SpanOperationBreakdownFilter) => {
    const {location, organization} = this.props;
    const {spanOperationBreakdownFilter, eventsDisplayFilterName, eventView} = this.state;

    trackAnalyticsEvent({
      eventName: 'Performance Views: Transaction Events Ops Breakdown Filter Dropdown',
      eventKey: 'performance_views.transactionEvents.ops_filter_dropdown.selection',
      organization_id: parseInt(organization.id, 10),
      action: newFilter as string,
    });

    // Check to see if the current table sort matches the EventsDisplayFilter.
    // If it does, we can re-sort using the new SpanOperationBreakdownFilter
    const eventsFilterOptionSort = getEventsFilterOptions(spanOperationBreakdownFilter)[
      eventsDisplayFilterName
    ].sort;
    const currentSort = eventView?.sorts?.[0];
    let sortQuery = {};

    if (
      eventsFilterOptionSort?.kind === currentSort?.kind &&
      eventsFilterOptionSort?.field === currentSort?.field
    ) {
      sortQuery = filterEventsDisplayToLocationQuery(eventsDisplayFilterName, newFilter);
    }

    const nextQuery: Location['query'] = {
      ...removeHistogramQueryStrings(location, [ZOOM_START, ZOOM_END]),
      ...filterToLocationQuery(newFilter),
      ...sortQuery,
    };

    if (newFilter === SpanOperationBreakdownFilter.None) {
      delete nextQuery.breakdown;
    }
    browserHistory.push({
      pathname: location.pathname,
      query: nextQuery,
    });
  };

  onChangeEventsDisplayFilter = (newFilterName: EventsDisplayFilterName) => {
    const {organization} = this.props;

    trackAnalyticsEvent({
      eventName: 'Performance Views: Transaction Events Display Filter Dropdown',
      eventKey: 'performance_views.transactionEvents.display_filter_dropdown.selection',
      organization_id: parseInt(organization.id, 10),
      action: newFilterName as string,
    });
    this.filterDropdownSortEvents(newFilterName);
  };

  filterDropdownSortEvents = (newFilterName: EventsDisplayFilterName) => {
    const {location} = this.props;
    const {spanOperationBreakdownFilter} = this.state;
    const nextQuery: Location['query'] = {
      ...removeHistogramQueryStrings(location, [ZOOM_START, ZOOM_END]),
      ...filterEventsDisplayToLocationQuery(newFilterName, spanOperationBreakdownFilter),
    };

    if (newFilterName === EventsDisplayFilterName.p100) {
      delete nextQuery.showTransaction;
    }

    browserHistory.push({
      pathname: location.pathname,
      query: nextQuery,
    });
  };

  getFilteredEventView = (percentiles: EventsFilterPercentileValues) => {
    const {eventsDisplayFilterName, spanOperationBreakdownFilter, eventView} = this.state;
    const filter = getEventsFilterOptions(spanOperationBreakdownFilter, percentiles)[
      eventsDisplayFilterName
    ];
    const filteredEventView = eventView?.clone();
    if (filteredEventView && filter?.query) {
      const query = tokenizeSearch(filteredEventView.query);
      filter.query.forEach(item => query.setTagValues(item[0], [item[1]]));
      filteredEventView.query = query.formatString();
    }
    return filteredEventView;
  };

  getDocumentTitle(): string {
    const name = getTransactionName(this.props.location);

    const hasTransactionName = typeof name === 'string' && String(name).trim().length > 0;

    if (hasTransactionName) {
      return [String(name).trim(), t('Events')].join(' \u2014 ');
    }

    return [t('Summary'), t('Events')].join(' \u2014 ');
  }

  getPercentilesEventView(eventView: EventView): EventView {
    const percentileColumns: QueryFieldValue[] = [
      {
        kind: 'function',
        function: ['p100', '', undefined, undefined],
      },
      {
        kind: 'function',
        function: ['p99', '', undefined, undefined],
      },
      {
        kind: 'function',
        function: ['p95', '', undefined, undefined],
      },
      {
        kind: 'function',
        function: ['p75', '', undefined, undefined],
      },
      {
        kind: 'function',
        function: ['p50', '', undefined, undefined],
      },
    ];

    return eventView.withColumns([...percentileColumns]);
  }

  renderNoAccess = () => {
    return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
  };

  render() {
    const {organization, projects, location} = this.props;
    const {eventView} = this.state;
    const transactionName = getTransactionName(location);
    const webVital = getWebVital(location);
    if (!eventView || transactionName === undefined) {
      // If there is no transaction name, redirect to the Performance landing page
      browserHistory.replace({
        pathname: `/organizations/${organization.slug}/performance/`,
        query: {
          ...location.query,
        },
      });
      return null;
    }
    const percentilesView = this.getPercentilesEventView(eventView);

    const shouldForceProject = eventView.project.length === 1;
    const forceProject = shouldForceProject
      ? projects.find(p => parseInt(p.id, 10) === eventView.project[0])
      : undefined;
    const projectSlugs = eventView.project
      .map(projectId => projects.find(p => parseInt(p.id, 10) === projectId))
      .filter((p: Project | undefined): p is Project => p !== undefined)
      .map(p => p.slug);

    return (
      <SentryDocumentTitle
        title={this.getDocumentTitle()}
        orgSlug={organization.slug}
        projectSlug={forceProject?.slug}
      >
        <Feature
          features={['performance-events-page']}
          organization={organization}
          renderDisabled={this.renderNoAccess}
        >
          <GlobalSelectionHeader
            lockedMessageSubject={t('transaction')}
            shouldForceProject={shouldForceProject}
            forceProject={forceProject}
            specificProjectSlugs={projectSlugs}
            disableMultipleProjectSelection
            showProjectSettingsLink
          >
            <LightWeightNoProjectMessage organization={organization}>
              <DiscoverQuery
                eventView={percentilesView}
                orgSlug={organization.slug}
                location={location}
                referrer="api.performance.transaction-events"
              >
                {({isLoading, tableData}) => {
                  const percentiles: PercentileValues = tableData?.data?.[0];
                  return (
                    <EventsPageContent
                      location={location}
                      eventView={this.getFilteredEventView(percentiles) as EventView}
                      transactionName={transactionName}
                      organization={organization}
                      projects={projects}
                      spanOperationBreakdownFilter={
                        this.state.spanOperationBreakdownFilter
                      }
                      onChangeSpanOperationBreakdownFilter={
                        this.onChangeSpanOperationBreakdownFilter
                      }
                      eventsDisplayFilterName={this.state.eventsDisplayFilterName}
                      onChangeEventsDisplayFilter={this.onChangeEventsDisplayFilter}
                      percentileValues={percentiles}
                      isLoading={isLoading}
                      webVital={webVital}
                    />
                  );
                }}
              </DiscoverQuery>
            </LightWeightNoProjectMessage>
          </GlobalSelectionHeader>
        </Feature>
      </SentryDocumentTitle>
    );
  }
}

function getWebVital(location: Location): WebVital | undefined {
  const webVital = decodeScalar(location.query.webVital, '') as WebVital;
  if (Object.values(WebVital).includes(webVital)) {
    return webVital;
  }
  return undefined;
}

function generateEventsEventView(
  location: Location,
  transactionName?: string
): EventView | undefined {
  if (transactionName === undefined) {
    return undefined;
  }
  const query = decodeScalar(location.query.query, '');
  const conditions = tokenizeSearch(query);
  conditions
    .setTagValues('event.type', ['transaction'])
    .setTagValues('transaction', [transactionName]);

  Object.keys(conditions.tagValues).forEach(field => {
    if (isAggregateField(field)) conditions.removeTag(field);
  });

  // Default fields for relative span view
  const fields = [
    'id',
    'user.display',
    SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
    'transaction.duration',
    'trace',
    'timestamp',
  ];
  const breakdown = decodeFilterFromLocation(location);
  if (breakdown !== SpanOperationBreakdownFilter.None) {
    fields.splice(2, 1, `spans.${breakdown}`);
  } else {
    fields.push(...SPAN_OP_BREAKDOWN_FIELDS);
  }
  const webVital = getWebVital(location);
  if (webVital) {
    fields.splice(3, 0, webVital);
  }

  return EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields,
      query: conditions.formatString(),
      projects: [],
      orderby: decodeScalar(location.query.sort, '-timestamp'),
    },
    location
  );
}

export default withGlobalSelection(withProjects(withOrganization(TransactionEvents)));
