import {useCallback, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {Tabs} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {useMetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import {PerformanceEventViewProvider} from 'sentry/utils/performance/contexts/performanceEventViewContext';
import {decodeScalar} from 'sentry/utils/queryString';

import {getSelectedProjectPlatforms, getTransactionName} from '../utils';

import {anomaliesRouteWithQuery} from './transactionAnomalies/utils';
import {eventsRouteWithQuery} from './transactionEvents/utils';
import {replaysRouteWithQuery} from './transactionReplays/utils';
import {spansRouteWithQuery} from './transactionSpans/utils';
import {tagsRouteWithQuery} from './transactionTags/utils';
import {vitalsRouteWithQuery} from './transactionVitals/utils';
import TransactionHeader from './header';
import Tab from './tabs';
import {TransactionThresholdMetric} from './transactionThresholdModal';
import {transactionSummaryRouteWithQuery} from './utils';

type AnalyticInfo = {
  eventKey: string;
  eventName: string;
};

const TAB_ANALYTICS: Partial<Record<Tab, AnalyticInfo>> = {
  [Tab.WebVitals]: {
    eventKey: 'performance_views.vitals.vitals_tab_clicked',
    eventName: 'Performance Views: Vitals tab clicked',
  },
  [Tab.Tags]: {
    eventKey: 'performance_views.tags.tags_tab_clicked',
    eventName: 'Performance Views: Tags tab clicked',
  },
  [Tab.Events]: {
    eventKey: 'performance_views.events.events_tab_clicked',
    eventName: 'Performance Views: Events tab clicked',
  },
  [Tab.Spans]: {
    eventKey: 'performance_views.spans.spans_tab_clicked',
    eventName: 'Performance Views: Spans tab clicked',
  },
  [Tab.Anomalies]: {
    eventKey: 'performance_views.anomalies.anomalies_tab_clicked',
    eventName: 'Performance Views: Anomalies tab clicked',
  },
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

  const projectId = decodeScalar(location.query.project);
  const transactionName = getTransactionName(location);
  const [error, setError] = useState<string | undefined>();
  const metricsCardinality = useMetricsCardinalityContext();
  const [transactionThreshold, setTransactionThreshold] = useState<number | undefined>();
  const [transactionThresholdMetric, setTransactionThresholdMetric] = useState<
    TransactionThresholdMetric | undefined
  >();

  const getNewRoute = useCallback(
    (newTab: Tab) => {
      if (!transactionName) {
        return {};
      }

      const routeQuery = {
        orgSlug: organization.slug,
        transaction: transactionName,
        projectID: projectId,
        query: location.query,
      };

      switch (newTab) {
        case Tab.Tags:
          return tagsRouteWithQuery(routeQuery);
        case Tab.Events:
          return eventsRouteWithQuery(routeQuery);
        case Tab.Spans:
          return spansRouteWithQuery(routeQuery);
        case Tab.Anomalies:
          return anomaliesRouteWithQuery(routeQuery);
        case Tab.Replays:
          return replaysRouteWithQuery(routeQuery);
        case Tab.WebVitals:
          return vitalsRouteWithQuery({
            orgSlug: organization.slug,
            transaction: transactionName,
            projectID: decodeScalar(location.query.project),
            query: location.query,
          });
        case Tab.TransactionSummary:
        default:
          return transactionSummaryRouteWithQuery(routeQuery);
      }
    },
    [location.query, organization.slug, projectId, transactionName]
  );

  const onTabChange = useCallback(
    (newTab: Tab) => {
      // Prevent infinite rerenders
      if (newTab === tab) {
        return;
      }

      const analyticKeys = TAB_ANALYTICS[newTab];
      if (analyticKeys) {
        trackAnalyticsEvent({
          ...analyticKeys,
          organization_id: organization.id,
          project_platforms: getSelectedProjectPlatforms(location, projects),
        });
      }

      browserHistory.push(getNewRoute(newTab));
    },
    [getNewRoute, tab, organization, location, projects]
  );

  if (!defined(projectId) || !defined(transactionName)) {
    redirectToPerformanceHomepage(organization, location);
    return null;
  }

  const project = projects.find(p => p.id === projectId);
  const eventView = generateEventView({location, transactionName, organization});

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
        <PerformanceEventViewProvider value={{eventView}}>
          <PageFiltersContainer
            shouldForceProject={defined(project)}
            forceProject={project}
            specificProjectSlugs={defined(project) ? [project.slug] : []}
          >
            <Tabs value={tab} onChange={onTabChange}>
              <StyledPageContent>
                <NoProjectMessage organization={organization}>
                  <TransactionHeader
                    eventView={eventView}
                    location={location}
                    organization={organization}
                    projects={projects}
                    projectId={projectId}
                    transactionName={transactionName}
                    currentTab={tab}
                    hasWebVitals={tab === Tab.WebVitals ? 'yes' : 'maybe'}
                    onChangeThreshold={(threshold, metric) => {
                      setTransactionThreshold(threshold);
                      setTransactionThresholdMetric(metric);
                    }}
                    metricsCardinality={metricsCardinality}
                  />
                  <Layout.Body>
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
                  </Layout.Body>
                </NoProjectMessage>
              </StyledPageContent>
            </Tabs>
          </PageFiltersContainer>
        </PerformanceEventViewProvider>
      </Feature>
    </SentryDocumentTitle>
  );
}

export function NoAccess() {
  return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const StyledAlert = styled(Alert)`
  grid-column: 1/3;
  margin: 0;
`;

export function redirectToPerformanceHomepage(
  organization: Organization,
  location: Location
) {
  // If there is no transaction name, redirect to the Performance landing page
  browserHistory.replace({
    pathname: `/organizations/${organization.slug}/performance/`,
    query: {
      ...location.query,
    },
  });
}

export default PageLayout;
