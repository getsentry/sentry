import {ReactNode, useEffect, useState} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {loadOrganizationTags} from 'app/actionCreators/tags';
import {Client} from 'app/api';
import GlobalSdkUpdateAlert from 'app/components/globalSdkUpdateAlert';
import * as Layout from 'app/components/layouts/thirds';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {GlobalSelection, Organization, Project} from 'app/types';
import {defined} from 'app/utils';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {
  Column,
  isAggregateField,
  QueryFieldValue,
  WebVital,
} from 'app/utils/discover/fields';
import {removeHistogramQueryStrings} from 'app/utils/performance/histogram';
import {decodeScalar} from 'app/utils/queryString';
import {MutableSearch} from 'app/utils/tokenizeSearch';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

import {addRoutePerformanceContext, getTransactionName} from '../../utils';
import {
  decodeFilterFromLocation,
  filterToLocationQuery,
  SpanOperationBreakdownFilter,
} from '../filter';
import TransactionHeader from '../header';
import Tab from '../tabs';
import {TransactionThresholdMetric} from '../transactionThresholdModal';
import {
  PERCENTILE as VITAL_PERCENTILE,
  VITAL_GROUPS,
} from '../transactionVitals/constants';

import SummaryContent from './content';
import {ZOOM_END, ZOOM_START} from './latencyChart';

// Used to cast the totals request to numbers
// as React.ReactText
type TotalValues = Record<string, number>;

type Props = RouteComponentProps<{}, {}> & {
  api: Client;
  selection: GlobalSelection;
  organization: Organization;
  projects: Project[];
};

function TransactionOverview(props: Props) {
  const {api, location, selection, organization, projects} = props;
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

  useEffect(() => {
    loadOrganizationTags(api, organization.slug, selection);
    addRoutePerformanceContext(selection);
  }, [selection]);

  const [incompatibleAlertNotice, setIncompatibleAlertNotice] = useState<ReactNode>(null);
  const handleIncompatibleQuery = (incompatibleAlertNoticeFn, _errors) => {
    const notice = incompatibleAlertNoticeFn(() => setIncompatibleAlertNotice(null));
    setIncompatibleAlertNotice(notice);
  };

  const [transactionThreshold, setTransactionThreshold] = useState<number | undefined>();
  const [transactionThresholdMetric, setTransactionThresholdMetric] = useState<
    TransactionThresholdMetric | undefined
  >();

  const spanOperationBreakdownFilter = decodeFilterFromLocation(location);

  const eventView = generateEventView(location, transactionName);
  const totalsView = getTotalsEventView(organization, eventView);

  const onChangeFilter = (newFilter: SpanOperationBreakdownFilter) => {
    trackAnalyticsEvent({
      eventName: 'Performance Views: Filter Dropdown',
      eventKey: 'performance_views.filter_dropdown.selection',
      organization_id: parseInt(organization.id, 10),
      action: newFilter as string,
    });

    const nextQuery: Location['query'] = {
      ...removeHistogramQueryStrings(location, [ZOOM_START, ZOOM_END]),
      ...filterToLocationQuery(newFilter),
    };

    if (newFilter === SpanOperationBreakdownFilter.None) {
      delete nextQuery.breakdown;
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
      <GlobalSelectionHeader
        lockedMessageSubject={t('transaction')}
        shouldForceProject={defined(project)}
        forceProject={project}
        specificProjectSlugs={defined(project) ? [project.slug] : []}
        disableMultipleProjectSelection
        showProjectSettingsLink
      >
        <StyledPageContent>
          <LightWeightNoProjectMessage organization={organization}>
            <TransactionHeader
              eventView={eventView}
              location={location}
              organization={organization}
              projects={projects}
              projectId={projectId}
              transactionName={transactionName}
              currentTab={Tab.TransactionSummary}
              hasWebVitals="maybe"
              handleIncompatibleQuery={handleIncompatibleQuery}
              onChangeThreshold={(threshold, metric) => {
                setTransactionThreshold(threshold);
                setTransactionThresholdMetric(metric);
              }}
            />
            <Layout.Body>
              <StyledSdkUpdatesAlert />
              {incompatibleAlertNotice && (
                <Layout.Main fullWidth>{incompatibleAlertNotice}</Layout.Main>
              )}
              <DiscoverQuery
                eventView={totalsView}
                orgSlug={organization.slug}
                location={location}
                transactionThreshold={transactionThreshold}
                transactionThresholdMetric={transactionThresholdMetric}
                referrer="api.performance.transaction-summary"
              >
                {({isLoading, error, tableData}) => {
                  const totals: TotalValues | null = tableData?.data?.[0] ?? null;
                  return (
                    <SummaryContent
                      location={location}
                      organization={organization}
                      eventView={eventView}
                      transactionName={transactionName}
                      isLoading={isLoading}
                      error={error}
                      totalValues={totals}
                      onChangeFilter={onChangeFilter}
                      spanOperationBreakdownFilter={spanOperationBreakdownFilter}
                    />
                  );
                }}
              </DiscoverQuery>
            </Layout.Body>
          </LightWeightNoProjectMessage>
        </StyledPageContent>
      </GlobalSelectionHeader>
    </SentryDocumentTitle>
  );
}

function getDocumentTitle(transactionName: string): string {
  const hasTransactionName =
    typeof transactionName === 'string' && String(transactionName).trim().length > 0;

  if (hasTransactionName) {
    return [String(transactionName).trim(), t('Performance')].join(' - ');
  }

  return [t('Summary'), t('Performance')].join(' - ');
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

function generateEventView(location: Location, transactionName: string): EventView {
  // Use the user supplied query but overwrite any transaction or event type
  // conditions they applied.
  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);
  conditions
    .setFilterValues('event.type', ['transaction'])
    .setFilterValues('transaction', [transactionName]);

  Object.keys(conditions.filters).forEach(field => {
    if (isAggregateField(field)) conditions.removeFilter(field);
  });

  const fields = ['id', 'user.display', 'transaction.duration', 'trace', 'timestamp'];

  return EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields,
      query: conditions.formatString(),
      projects: [],
    },
    location
  );
}

function getTotalsEventView(
  _organization: Organization,
  eventView: EventView
): EventView {
  const vitals = VITAL_GROUPS.map(({vitals: vs}) => vs).reduce((keys: WebVital[], vs) => {
    vs.forEach(vital => keys.push(vital));
    return keys;
  }, []);

  const totalsColumns: QueryFieldValue[] = [
    {
      kind: 'function',
      function: ['p95', '', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['count', '', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['count_unique', 'user', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['failure_rate', '', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['tpm', '', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['count_miserable', 'user', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['user_misery', '', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['apdex', '', undefined, undefined],
    },
  ];

  return eventView.withColumns([
    ...totalsColumns,
    ...vitals.map(
      vital =>
        ({
          kind: 'function',
          function: ['percentile', vital, VITAL_PERCENTILE.toString(), undefined],
        } as Column)
    ),
  ]);
}

const StyledSdkUpdatesAlert = styled(GlobalSdkUpdateAlert)`
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    margin-bottom: 0;
  }
`;

StyledSdkUpdatesAlert.defaultProps = {
  Wrapper: p => <Layout.Main fullWidth {...p} />,
};

export default withApi(
  withGlobalSelection(withProjects(withOrganization(TransactionOverview)))
);
