import {useCallback, useMemo, useState} from 'react';
import {Outlet} from 'react-router-dom';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {isString} from '@sentry/core';
import type {Location} from 'history';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';
import {Tabs} from '@sentry/scraps/tabs';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {PickProjectToContinue} from 'sentry/components/pickProjectToContinue';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {defined} from 'sentry/utils/defined';
import {DiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import {EventView} from 'sentry/utils/discover/eventView';
import {isAggregateField} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  MetricsCardinalityProvider,
  useMetricsCardinalityContext,
} from 'sentry/utils/performance/contexts/metricsCardinality';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';
import {TransactionSummaryContext} from 'sentry/views/performance/transactionSummary/transactionSummaryContext';
import {
  getPerformanceBaseUrl,
  getSelectedProjectPlatforms,
  getTransactionName,
} from 'sentry/views/performance/utils';

import {eventsRouteWithQuery} from './transactionEvents/utils';
import {profilesRouteWithQuery} from './transactionProfiles/utils';
import {replaysRouteWithQuery} from './transactionReplays/utils';
import {TransactionHeader} from './header';
import {Tab} from './tabs';
import type {TransactionThresholdMetric} from './transactionThresholdModal';
import {generateTransactionSummaryRoute, transactionSummaryRouteWithQuery} from './utils';

type TabEvents =
  | 'performance_views.events.events_tab_clicked'
  | 'performance_views.spans.spans_tab_clicked';

export const TAB_ANALYTICS: Partial<Record<Tab, TabEvents>> = {
  [Tab.EVENTS]: 'performance_views.events.events_tab_clicked',
};

type Props = {
  getDocumentTitle: (name: string) => string;
  location: Location;
  organization: Organization;
  projects: Project[];
  tab: Tab;
  features?: string[];
  fillSpace?: boolean;
};

export function PageLayout(props: Props) {
  const {location, organization, projects, tab, getDocumentTitle, features = []} = props;

  let projectId: string | undefined;
  const filterProjects = location.query.project;

  if (isString(filterProjects) && filterProjects !== '-1') {
    projectId = filterProjects;
  }

  const navigate = useNavigate();
  const transactionName = getTransactionName(location);
  const [error, setError] = useState<string | undefined>();
  const metricsCardinality = useMetricsCardinalityContext();
  const [transactionThreshold, setTransactionThreshold] = useState<number | undefined>();
  const [transactionThresholdMetric, setTransactionThresholdMetric] = useState<
    TransactionThresholdMetric | undefined
  >();

  const dataCategories: [DataCategory, ...DataCategory[]] = useMemo(() => {
    switch (tab) {
      case Tab.PROFILING:
        return [DataCategory.PROFILE_DURATION, DataCategory.PROFILE_DURATION_UI];
      case Tab.REPLAYS:
        return [DataCategory.REPLAYS];
      case Tab.EVENTS:
      case Tab.TRANSACTION_SUMMARY:
        return [DataCategory.SPANS];
      default:
        throw new Error(`Unsupported tab: ${tab}`);
    }
  }, [tab]);

  const maxPickableDays = useMaxPickableDays({
    dataCategories,
  });
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

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
        case Tab.EVENTS:
          return eventsRouteWithQuery(routeQuery);
        case Tab.REPLAYS:
          return replaysRouteWithQuery(routeQuery);
        case Tab.PROFILING: {
          return profilesRouteWithQuery(routeQuery);
        }
        case Tab.TRANSACTION_SUMMARY:
        default:
          return transactionSummaryRouteWithQuery(routeQuery);
      }
    },
    [location.query, organization, projectId, transactionName]
  );

  const onTabChange = (newTab: Tab) => {
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

    navigate(normalizeUrl(getNewRoute(newTab)));
  };

  if (!defined(transactionName)) {
    redirectToPerformanceHomepage(organization, location, navigate);
    return null;
  }

  const conditions = new MutableSearch(decodeScalar(location.query.query, ''));
  conditions.setFilterValues('transaction', [transactionName]);
  Object.keys(conditions.filters).forEach(field => {
    if (isAggregateField(field)) {
      conditions.removeFilter(field);
    }
  });

  const eventView = EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields: ['project', 'count()'],
      query: conditions.formatString(),
      projects: [],
      dataset: DiscoverDatasets.SPANS,
    },
    location
  );

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
        referrer="api.insights.transaction-summary"
      >
        {({isLoading, tableData, error: discoverQueryError}) => {
          if (discoverQueryError) {
            addErrorMessage(t('Unable to get projects associated with transaction'));
            redirectToPerformanceHomepage(organization, location, navigate);
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
          <PageFiltersContainer
            shouldForceProject={defined(project)}
            forceProject={project}
            specificProjectSlugs={defined(project) ? [project.slug] : []}
            maxPickableDays={datePageFilterProps.maxPickableDays}
            defaultSelection={
              datePageFilterProps.defaultPeriod
                ? {
                    datetime: {
                      period: datePageFilterProps.defaultPeriod,
                      start: null,
                      end: null,
                      utc: null,
                    },
                  }
                : undefined
            }
          >
            <Tabs value={tab} onChange={onTabChange}>
              <Stack flex={1}>
                <TransactionHeader
                  eventView={eventView}
                  location={location}
                  organization={organization}
                  projects={projects}
                  projectId={projectId}
                  transactionName={transactionName}
                  currentTab={tab}
                  onChangeThreshold={(threshold, metric) => {
                    setTransactionThreshold(threshold);
                    setTransactionThresholdMetric(metric);
                  }}
                  metricsCardinality={metricsCardinality}
                />
                <StyledBody fillSpace={props.fillSpace} hasError={defined(error)}>
                  {defined(error) && <StyledAlert variant="danger">{error}</StyledAlert>}
                  <TransactionSummaryContext
                    value={{
                      organization,
                      projectId,
                      projects,
                      setError,
                      transactionName,
                      transactionThreshold,
                      transactionThresholdMetric,
                    }}
                  >
                    <Outlet />
                  </TransactionSummaryContext>
                </StyledBody>
              </Stack>
            </Tabs>
          </PageFiltersContainer>
        </MetricsCardinalityProvider>
      </Feature>
    </SentryDocumentTitle>
  );
}

function NoAccess() {
  return (
    <Alert.Container>
      <Alert variant="warning" showIcon={false}>
        {t("You don't have access to this feature")}
      </Alert>
    </Alert.Container>
  );
}

const StyledAlert = styled(Alert)`
  grid-column: 1/3;
`;

const StyledBody = styled(Layout.Body)<{fillSpace?: boolean; hasError?: boolean}>`
  ${p =>
    p.fillSpace &&
    css`
      display: flex;
      flex-direction: column;
      gap: ${p.theme.space['2xl']};

      @media (min-width: ${p.theme.breakpoints.lg}) {
        display: flex;
        flex-direction: column;
        gap: ${p.theme.space['2xl']};
      }
    `}
`;

export function redirectToPerformanceHomepage(
  organization: Organization,
  location: Location,
  navigate: ReactRouter3Navigate
) {
  // If there is no transaction name, redirect to the Performance landing page
  navigate(
    normalizeUrl({
      pathname: getPerformanceBaseUrl(organization.slug, 'backend'),
      query: {
        ...location.query,
      },
    }),
    {replace: true}
  );
}
