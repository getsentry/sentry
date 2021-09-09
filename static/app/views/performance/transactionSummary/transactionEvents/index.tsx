import {ReactNode, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import GlobalSdkUpdateAlert from 'app/components/globalSdkUpdateAlert';
import * as Layout from 'app/components/layouts/thirds';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import LoadingIndicator from 'app/components/loadingIndicator';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {IconFlag} from 'app/icons';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import {defined} from 'app/utils';
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
import {MutableSearch} from 'app/utils/tokenizeSearch';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

import {getTransactionName} from '../../utils';
import {
  decodeFilterFromLocation,
  filterToLocationQuery,
  SpanOperationBreakdownFilter,
} from '../filter';
import TransactionHeader from '../header';
import Tab from '../tabs';
import {ZOOM_END, ZOOM_START} from '../transactionOverview/latencyChart';

import EventsContent from './content';
import {
  decodeEventsDisplayFilterFromLocation,
  EventsDisplayFilterName,
  filterEventsDisplayToLocationQuery,
  getEventsFilterOptions,
} from './utils';

type PercentileValues = Record<EventsDisplayFilterName, number>;

type Props = {
  location: Location;
  organization: Organization;
  projects: Project[];
};

function TransactionEvents(props: Props) {
  const {location, organization, projects} = props;
  const projectId = decodeScalar(location.query.project);
  const transactionName = getTransactionName(location);

  if (!defined(projectId) || !defined(transactionName)) {
    // If there is no transaction name, redirect to the Performance landing page
    browserHistory.replace({
      pathname: `/organizations/${organization.slug}/performance/`,
      query: {
        ...location.query,
      },
    });
    return null;
  }

  const project = projects.find(p => p.id === projectId);

  const [incompatibleAlertNotice, setIncompatibleAlertNotice] = useState<ReactNode>(null);
  const handleIncompatibleQuery = (incompatibleAlertNoticeFn, _errors) => {
    const notice = incompatibleAlertNoticeFn(() => setIncompatibleAlertNotice(null));
    setIncompatibleAlertNotice(notice);
  };

  const [error, setError] = useState<string | undefined>();

  const eventsDisplayFilterName = decodeEventsDisplayFilterFromLocation(location);
  const spanOperationBreakdownFilter = decodeFilterFromLocation(location);
  const webVital = getWebVital(location);

  const eventView = generateEventView(location, transactionName);
  const percentilesView = getPercentilesEventView(eventView);

  const getFilteredEventView = (percentiles: PercentileValues) => {
    const filter = getEventsFilterOptions(spanOperationBreakdownFilter, percentiles)[
      eventsDisplayFilterName
    ];
    const filteredEventView = eventView?.clone();
    if (filteredEventView && filter?.query) {
      const query = new MutableSearch(filteredEventView.query);
      filter.query.forEach(item => query.setFilterValues(item[0], [item[1]]));
      filteredEventView.query = query.formatString();
    }
    return filteredEventView;
  };

  const onChangeSpanOperationBreakdownFilter = (
    newFilter: SpanOperationBreakdownFilter
  ) => {
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

  const onChangeEventsDisplayFilter = (newFilterName: EventsDisplayFilterName) => {
    trackAnalyticsEvent({
      eventName: 'Performance Views: Transaction Events Display Filter Dropdown',
      eventKey: 'performance_views.transactionEvents.display_filter_dropdown.selection',
      organization_id: parseInt(organization.id, 10),
      action: newFilterName as string,
    });

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

  return (
    <SentryDocumentTitle
      title={getDocumentTitle(transactionName)}
      orgSlug={organization.slug}
      projectSlug={project?.slug}
    >
      <Feature
        features={['performance-events-page']}
        organization={organization}
        renderDisabled={NoAccess}
      >
        <GlobalSelectionHeader
          lockedMessageSubject={t('transaction')}
          shouldForceProject={defined(project)}
          forceProject={project}
          specificProjectSlugs={defined(project) ? [project.slug] : []}
          disableMultipleProjectSelection
          showProjectSettingsLink
        >
          <LightWeightNoProjectMessage organization={organization}>
            <TransactionHeader
              eventView={eventView}
              location={location}
              organization={organization}
              projects={projects}
              projectId={projectId}
              transactionName={transactionName}
              currentTab={Tab.Events}
              hasWebVitals="maybe"
              handleIncompatibleQuery={handleIncompatibleQuery}
            />
            <Layout.Body>
              <StyledSdkUpdatesAlert />
              {defined(error) && (
                <StyledAlert type="error" icon={<IconFlag size="md" />}>
                  {error}
                </StyledAlert>
              )}
              {incompatibleAlertNotice && (
                <Layout.Main fullWidth>{incompatibleAlertNotice}</Layout.Main>
              )}
              <DiscoverQuery
                eventView={percentilesView}
                orgSlug={organization.slug}
                location={location}
                referrer="api.performance.transaction-events"
              >
                {({isLoading, tableData}) => {
                  if (isLoading) {
                    return (
                      <Layout.Main fullWidth>
                        <LoadingIndicator />
                      </Layout.Main>
                    );
                  }

                  const percentiles: PercentileValues = tableData?.data?.[0];
                  const filteredEventView = getFilteredEventView(percentiles);

                  return (
                    <EventsContent
                      location={location}
                      organization={organization}
                      eventView={filteredEventView}
                      transactionName={transactionName}
                      spanOperationBreakdownFilter={spanOperationBreakdownFilter}
                      onChangeSpanOperationBreakdownFilter={
                        onChangeSpanOperationBreakdownFilter
                      }
                      eventsDisplayFilterName={eventsDisplayFilterName}
                      onChangeEventsDisplayFilter={onChangeEventsDisplayFilter}
                      percentileValues={percentiles}
                      webVital={webVital}
                      setError={setError}
                    />
                  );
                }}
              </DiscoverQuery>
            </Layout.Body>
          </LightWeightNoProjectMessage>
        </GlobalSelectionHeader>
      </Feature>
    </SentryDocumentTitle>
  );
}

function getDocumentTitle(transactionName: string): string {
  const hasTransactionName =
    typeof transactionName === 'string' && String(transactionName).trim().length > 0;

  if (hasTransactionName) {
    return [String(transactionName).trim(), t('Events')].join(' \u2014 ');
  }

  return [t('Summary'), t('Events')].join(' \u2014 ');
}

function NoAccess() {
  return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
}

function getWebVital(location: Location): WebVital | undefined {
  const webVital = decodeScalar(location.query.webVital, '') as WebVital;
  if (Object.values(WebVital).includes(webVital)) {
    return webVital;
  }
  return undefined;
}

function generateEventView(location: Location, transactionName: string): EventView {
  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);
  conditions
    .setFilterValues('event.type', ['transaction'])
    .setFilterValues('transaction', [transactionName]);

  Object.keys(conditions.filters).forEach(field => {
    if (isAggregateField(field)) conditions.removeFilter(field);
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

function getPercentilesEventView(eventView: EventView): EventView {
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

  return eventView.withColumns(percentileColumns);
}

const StyledAlert = styled(Alert)`
  grid-column: 1/3;
  margin: 0;
`;

const StyledSdkUpdatesAlert = styled(GlobalSdkUpdateAlert)`
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    margin-bottom: 0;
  }
`;

StyledSdkUpdatesAlert.defaultProps = {
  Wrapper: p => <Layout.Main fullWidth {...p} />,
};

export default withProjects(withOrganization(TransactionEvents));
