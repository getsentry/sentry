import {useCallback, useState} from 'react';
import styled from '@emotion/styled';
import {isString} from '@sentry/core';
import type {Location} from 'history';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import PickProjectToContinue from 'sentry/components/pickProjectToContinue';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {Tabs} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import type EventView from 'sentry/utils/discover/eventView';
import {
  MetricsCardinalityProvider,
  useMetricsCardinalityContext,
} from 'sentry/utils/performance/contexts/metricsCardinality';
import {PerformanceEventViewProvider} from 'sentry/utils/performance/contexts/performanceEventViewContext';
import {decodeScalar} from 'sentry/utils/queryString';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useRouter from 'sentry/utils/useRouter';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {aggregateWaterfallRouteWithQuery} from 'sentry/views/performance/transactionSummary/aggregateSpanWaterfall/utils';

import {
  getPerformanceBaseUrl,
  getSelectedProjectPlatforms,
  getTransactionName,
} from '../utils';

import {eventsRouteWithQuery} from './transactionEvents/utils';
import {profilesRouteWithQuery} from './transactionProfiles/utils';
import {replaysRouteWithQuery} from './transactionReplays/utils';
import {spansRouteWithQuery} from './transactionSpans/utils';
import {tagsRouteWithQuery} from './transactionTags/utils';
import {vitalsRouteWithQuery} from './transactionVitals/utils';
import TransactionHeader, {type Props as TransactionHeaderProps} from './header';
import Tab from './tabs';
import type {TransactionThresholdMetric} from './transactionThresholdModal';
import {generateTransactionSummaryRoute, transactionSummaryRouteWithQuery} from './utils';

type TabEvents =
  | 'performance_views.vitals.vitals_tab_clicked'
  | 'performance_views.tags.tags_tab_clicked'
  | 'performance_views.events.events_tab_clicked'
  | 'performance_views.spans.spans_tab_clicked';

export const TAB_ANALYTICS: Partial<Record<Tab, TabEvents>> = {
  [Tab.WEB_VITALS]: 'performance_views.vitals.vitals_tab_clicked',
  [Tab.TAGS]: 'performance_views.tags.tags_tab_clicked',
  [Tab.EVENTS]: 'performance_views.events.events_tab_clicked',
  [Tab.SPANS]: 'performance_views.spans.spans_tab_clicked',
};

export type ChildProps = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projectId: string;
  projects: Project[];
  setError: React.Dispatch<React.SetStateAction<string | undefined>>;
  transactionName: string;
  // These are used to trigger a reload when the threshold/metric changes.
  transactionThreshold?: number;
  transactionThresholdMetric?: TransactionThresholdMetric;
};

type Props = {
  childComponent: (props: ChildProps) => JSX.Element;
  generateEventView: (props: {
    location: Location;
    organization: Organization;
    transactionName: string;
  }) => EventView;
  getDocumentTitle: (name: string) => string;
  location: Location;
  organization: Organization;
  projects: Project[];
  tab: Tab;
  features?: string[];
  fillSpace?: boolean;
};

function PageLayout(props: Props) {
  const {
    location,
    organization,
    projects,
    tab,
    getDocumentTitle,
    generateEventView,
    childComponent: ChildComponent,
    features = [],
  } = props;

  let projectId: string | undefined;
  const filterProjects = location.query.project;

  if (isString(filterProjects) && filterProjects !== '-1') {
    projectId = filterProjects;
  }

  const router = useRouter();
  const transactionName = getTransactionName(location);
  const [error, setError] = useState<string | undefined>();
  const metricsCardinality = useMetricsCardinalityContext();
  const [transactionThreshold, setTransactionThreshold] = useState<number | undefined>();
  const [transactionThresholdMetric, setTransactionThresholdMetric] = useState<
    TransactionThresholdMetric | undefined
  >();

  const {isInDomainView} = useDomainViewFilters();

  const getNewRoute = useCallback(
    (newTab: Tab) => {
      if (!transactionName) {
        return {};
      }

      const routeQuery = {
        organization,
        transaction: transactionName,
        projectID: projectId,
        query: location.query,
      };

      switch (newTab) {
        case Tab.TAGS:
          return tagsRouteWithQuery(routeQuery);
        case Tab.EVENTS:
          return eventsRouteWithQuery(routeQuery);
        case Tab.SPANS:
          return spansRouteWithQuery(routeQuery);
        case Tab.REPLAYS:
          return replaysRouteWithQuery(routeQuery);
        case Tab.PROFILING: {
          return profilesRouteWithQuery(routeQuery);
        }
        case Tab.AGGREGATE_WATERFALL:
          return aggregateWaterfallRouteWithQuery(routeQuery);
        case Tab.WEB_VITALS:
          return vitalsRouteWithQuery({
            organization,
            transaction: transactionName,
            projectID: decodeScalar(location.query.project),
            query: location.query,
          });
        case Tab.TRANSACTION_SUMMARY:
        default:
          return transactionSummaryRouteWithQuery(routeQuery);
      }
    },
    [location.query, organization, projectId, transactionName]
  );

  const onTabChange = useCallback(
    (newTab: Tab) => {
      // Prevent infinite rerenders
      if (newTab === tab) {
        return;
      }

      const analyticsKey = TAB_ANALYTICS[newTab];
      if (analyticsKey) {
        trackAnalytics(analyticsKey, {
          organization,
          project_platforms: getSelectedProjectPlatforms(location, projects),
        });
      }

      browserHistory.push(normalizeUrl(getNewRoute(newTab)));
    },
    [getNewRoute, tab, organization, location, projects]
  );

  if (!defined(transactionName)) {
    redirectToPerformanceHomepage(organization, location);
    return null;
  }

  const eventView = generateEventView({location, transactionName, organization});

  if (!defined(projectId)) {
    // Using a discover query to get the projects associated
    // with a transaction name
    const nextView = eventView.clone();
    nextView.query = `transaction:"${transactionName}"`;
    nextView.fields = [
      {
        field: 'project',
        width: COL_WIDTH_UNDEFINED,
      },
      {
        field: 'count()',
        width: COL_WIDTH_UNDEFINED,
      },
    ];

    return (
      <DiscoverQuery
        eventView={nextView}
        location={location}
        orgSlug={organization.slug}
        queryExtras={{project: filterProjects ? filterProjects : undefined}}
        referrer="api.performance.transaction-summary"
      >
        {({isLoading, tableData, error: discoverQueryError}) => {
          if (discoverQueryError) {
            addErrorMessage(t('Unable to get projects associated with transaction'));
            redirectToPerformanceHomepage(organization, location);
            return null;
          }

          if (isLoading) {
            return <LoadingIndicator />;
          }

          const selectableProjects = tableData?.data
            .map(row => projects.find(project => project.slug === row.project))
            .filter((p): p is Project => p !== undefined);

          return (
            selectableProjects && (
              <PickProjectToContinue
                data-test-id="transaction-sumamry-project-picker-modal"
                projects={selectableProjects}
                router={router}
                nextPath={{
                  pathname: generateTransactionSummaryRoute({organization}),
                  query: {
                    project: projectId,
                    transaction: transactionName,
                    statsPeriod: eventView.statsPeriod,
                    referrer: 'performance-transaction-summary',
                    ...location.query,
                  },
                }}
                noProjectRedirectPath="/performance/"
                allowAllProjectsSelection
              />
            )
          );
        }}
      </DiscoverQuery>
    );
  }

  const project = projects.find(p => p.id === projectId);

  let hasWebVitals: TransactionHeaderProps['hasWebVitals'] =
    tab === Tab.WEB_VITALS ? 'yes' : 'maybe';
  if (isInDomainView) {
    hasWebVitals = 'no';
  }

  return (
    <SentryDocumentTitle
      title={getDocumentTitle(transactionName)}
      orgSlug={organization.slug}
      projectSlug={project?.slug}
    >
      <Feature
        features={['performance-view', ...features]}
        organization={organization}
        renderDisabled={NoAccess}
      >
        <MetricsCardinalityProvider location={location} organization={organization}>
          <PerformanceEventViewProvider value={{eventView}}>
            <PageFiltersContainer
              shouldForceProject={defined(project)}
              forceProject={project}
              specificProjectSlugs={defined(project) ? [project.slug] : []}
            >
              <Tabs value={tab} onChange={onTabChange}>
                <Layout.Page>
                  <TransactionHeader
                    eventView={eventView}
                    location={location}
                    organization={organization}
                    projects={projects}
                    projectId={projectId}
                    transactionName={transactionName}
                    currentTab={tab}
                    hasWebVitals={hasWebVitals}
                    onChangeThreshold={(threshold, metric) => {
                      setTransactionThreshold(threshold);
                      setTransactionThresholdMetric(metric);
                    }}
                    metricsCardinality={metricsCardinality}
                  />
                  <StyledBody fillSpace={props.fillSpace} hasError={defined(error)}>
                    {defined(error) && (
                      <StyledAlert type="error" showIcon>
                        {error}
                      </StyledAlert>
                    )}
                    <ChildComponent
                      location={location}
                      organization={organization}
                      projects={projects}
                      eventView={eventView}
                      projectId={projectId}
                      transactionName={transactionName}
                      setError={setError}
                      transactionThreshold={transactionThreshold}
                      transactionThresholdMetric={transactionThresholdMetric}
                    />
                  </StyledBody>
                </Layout.Page>
              </Tabs>
            </PageFiltersContainer>
          </PerformanceEventViewProvider>
        </MetricsCardinalityProvider>
      </Feature>
    </SentryDocumentTitle>
  );
}

export function NoAccess() {
  return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
}

const StyledAlert = styled(Alert)`
  grid-column: 1/3;
  margin: 0;
`;

const StyledBody = styled(Layout.Body)<{fillSpace?: boolean; hasError?: boolean}>`
  ${p =>
    p.fillSpace &&
    `
  display: flex;
  flex-direction: column;
  gap: ${space(3)};

  @media (min-width: ${p.theme.breakpoints.large}) {
    display: flex;
    flex-direction: column;
    gap: ${space(3)};
  }
  `}
`;

export function redirectToPerformanceHomepage(
  organization: Organization,
  location: Location
) {
  // If there is no transaction name, redirect to the Performance landing page
  browserHistory.replace(
    normalizeUrl({
      pathname: getPerformanceBaseUrl(organization.slug),
      query: {
        ...location.query,
      },
    })
  );
}

export default PageLayout;
