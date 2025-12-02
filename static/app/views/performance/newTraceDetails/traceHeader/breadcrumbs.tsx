import styled from '@emotion/styled';
import type {Location} from 'history';
import omit from 'lodash/omit';

import type {Crumb} from 'sentry/components/breadcrumbs';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {makeDiscoverPathname} from 'sentry/views/discover/pathnames';
import {makeFeedbackPathname} from 'sentry/views/feedback/pathnames';
import type {
  RoutableModuleNames,
  URLBuilder,
} from 'sentry/views/insights/common/utils/useModuleURL';
import {
  DOMAIN_VIEW_BASE_TITLE,
  DOMAIN_VIEW_BASE_URL,
} from 'sentry/views/insights/pages/settings';
import {DOMAIN_VIEW_TITLES} from 'sentry/views/insights/pages/types';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {ModuleName} from 'sentry/views/insights/types';
import Tab from 'sentry/views/performance/transactionSummary/tabs';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';
import {getPerformanceBaseUrl} from 'sentry/views/performance/utils';
import {makeTracesPathname} from 'sentry/views/traces/pathnames';

export enum TraceViewSources {
  TRACES = 'traces',
  METRICS = 'metrics',
  DISCOVER = 'discover',
  PROFILING_FLAMEGRAPH = 'profiling_flamegraph',
  REQUESTS_MODULE = 'requests_module',
  QUERIES_MODULE = 'queries_module',
  ASSETS_MODULE = 'assets_module',
  APP_STARTS_MODULE = 'app_starts_module',
  SCREEN_LOADS_MODULE = 'screen_loads_module',
  WEB_VITALS_MODULE = 'web_vitals_module',
  CACHES_MODULE = 'caches_module',
  QUEUES_MODULE = 'queues_module',
  LLM_MODULE = 'llm_module',
  SCREEN_LOAD_MODULE = 'screen_load_module',
  MOBILE_SCREENS_MODULE = 'mobile_screens_module',
  SCREEN_RENDERING_MODULE = 'screen_rendering_module',
  PERFORMANCE_TRANSACTION_SUMMARY = 'performance_transaction_summary',
  ISSUE_DETAILS = 'issue_details',
  DASHBOARDS = 'dashboards',
  FEEDBACK_DETAILS = 'feedback_details',
  LOGS = 'logs',
  AGENT_MONITORING = 'agent_monitoring',
  TRACE_METRICS = 'trace_metrics',
}

// Ideally every new entry to ModuleName, would require a new source to be added here so we don't miss any.
const TRACE_SOURCE_TO_INSIGHTS_MODULE: Partial<Record<TraceViewSources, ModuleName>> = {
  app_starts_module: ModuleName.APP_START,
  assets_module: ModuleName.RESOURCE,
  caches_module: ModuleName.CACHE,
  queries_module: ModuleName.DB,
  requests_module: ModuleName.HTTP,
  screen_loads_module: ModuleName.SCREEN_LOAD,
  web_vitals_module: ModuleName.VITAL,
  queues_module: ModuleName.QUEUE,
  screen_load_module: ModuleName.SCREEN_LOAD,
  screen_rendering_module: ModuleName.SCREEN_RENDERING,
  mobile_screens_module: ModuleName.MOBILE_VITALS,
};

export const TRACE_SOURCE_TO_NON_INSIGHT_ROUTES: Partial<
  Record<TraceViewSources, string>
> = {
  traces: 'explore/traces',
  metrics: 'metrics',
  discover: 'explore/discover',
  profiling_flamegraph: 'explore/profiling',
  performance_transaction_summary: 'insights/summary',
  issue_details: 'issues',
  feedback_details: 'issues/feedback',
  dashboards: 'dashboards',
  logs: 'explore/logs',
  trace_metrics: 'explore/metrics',
};

function getBreadCrumbTarget(pathname: string, query: Location['query']) {
  return {
    pathname,
    // Remove traceView specific query parameters that are not needed when navigating back.
    query: {...omit(query, ['node', 'fov', 'timestamp', 'eventId'])},
  };
}

function getPerformanceBreadCrumbs(
  organization: Organization,
  location: Location,
  leafBreadcrumb: Crumb,
  view?: DomainView
) {
  const crumbs: Crumb[] = [];

  const performanceUrl = getPerformanceBaseUrl(organization.slug, view, true);
  const transactionSummaryUrl = getTransactionSummaryBaseUrl(organization, view, true);

  if (view) {
    crumbs.push({
      label: DOMAIN_VIEW_TITLES[view],
      to: getBreadCrumbTarget(
        normalizeUrl(`/organizations/${organization.slug}/${performanceUrl}`),
        location.query
      ),
    });
  } else {
    crumbs.push({
      label: DOMAIN_VIEW_BASE_TITLE,
      to: undefined,
    });
  }

  switch (location.query.tab) {
    case Tab.EVENTS:
      crumbs.push({
        label: t('Transaction Summary'),
        to: getBreadCrumbTarget(
          normalizeUrl(`/organizations/${organization.slug}/${transactionSummaryUrl}`),
          location.query
        ),
      });
      break;
    case Tab.TAGS:
      crumbs.push({
        label: t('Tags'),
        to: getBreadCrumbTarget(
          normalizeUrl(
            `/organizations/${organization.slug}/${transactionSummaryUrl}/tags`
          ),
          location.query
        ),
      });
      break;
    default:
      crumbs.push({
        label: t('Transaction Summary'),
        to: getBreadCrumbTarget(
          normalizeUrl(`/organizations/${organization.slug}/${transactionSummaryUrl}`),
          location.query
        ),
      });
      break;
  }

  crumbs.push(leafBreadcrumb);

  return crumbs;
}

function getIssuesBreadCrumbs(
  organization: Organization,
  location: Location,
  leafBreadcrumb: Crumb
) {
  const crumbs: Crumb[] = [];

  crumbs.push({
    label: t('Issues'),
    to: getBreadCrumbTarget(
      normalizeUrl(`/organizations/${organization.slug}/issues/`),
      location.query
    ),
  });

  if (location.query.groupId) {
    crumbs.push({
      label: t('Issue Details'),
      to: getBreadCrumbTarget(
        normalizeUrl(
          `/organizations/${organization.slug}/issues/${location.query.groupId}/`
        ),
        location.query
      ),
    });
  }

  crumbs.push(leafBreadcrumb);

  return crumbs;
}

function getDashboardsBreadCrumbs(
  organization: Organization,
  location: Location,
  leafBreadcrumb: Crumb
) {
  const crumbs: Crumb[] = [];

  crumbs.push({
    label: t('Dashboards'),
    to: getBreadCrumbTarget(
      normalizeUrl(`/organizations/${organization.slug}/dashboards/`),
      location.query
    ),
  });

  if (location.query.dashboardId) {
    crumbs.push({
      label: t('Widgets Legend'),
      to: getBreadCrumbTarget(
        normalizeUrl(
          `/organizations/${organization.slug}/dashboard/${location.query.dashboardId}/`
        ),
        location.query
      ),
    });

    if (location.query.widgetId) {
      crumbs.push({
        label: t('Widget'),
        to: getBreadCrumbTarget(
          normalizeUrl(
            `/organizations/${organization.slug}/dashboard/${location.query.dashboardId}/widget/${location.query.widgetId}/`
          ),
          location.query
        ),
      });
    }
  }

  crumbs.push(leafBreadcrumb);

  return crumbs;
}

function getInsightsModuleBreadcrumbs(
  location: Location,
  organization: Organization,
  moduleURLBuilder: URLBuilder,
  leafBreadcrumb: Crumb,
  view?: DomainView
) {
  const crumbs: Crumb[] = [];

  if (view && DOMAIN_VIEW_TITLES[view]) {
    crumbs.push({
      label: DOMAIN_VIEW_TITLES[view],
      to: getBreadCrumbTarget(
        normalizeUrl(
          `/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}/${view}/`
        ),
        location.query
      ),
    });
  } else {
    crumbs.push({
      label: t('Insights'),
    });
  }

  let moduleName: RoutableModuleNames | undefined = undefined;

  if (
    typeof location.query.source === 'string' &&
    TRACE_SOURCE_TO_INSIGHTS_MODULE[
      location.query.source as keyof typeof TRACE_SOURCE_TO_INSIGHTS_MODULE
    ]
  ) {
    moduleName = TRACE_SOURCE_TO_INSIGHTS_MODULE[
      location.query.source as keyof typeof TRACE_SOURCE_TO_INSIGHTS_MODULE
    ] as RoutableModuleNames;
  }

  switch (moduleName) {
    case ModuleName.HTTP:
      crumbs.push({
        label: t('Domain Summary'),
        to: getBreadCrumbTarget(
          normalizeUrl(
            `/organizations/${organization.slug}/${moduleURLBuilder(moduleName, view)}/domains`
          ),
          location.query
        ),
      });
      break;
    case ModuleName.DB:
      if (location.query.groupId) {
        crumbs.push({
          label: t('Query Summary'),
          to: getBreadCrumbTarget(
            normalizeUrl(
              `/organizations/${organization.slug}/${moduleURLBuilder(moduleName, view)}/spans/span/${location.query.groupId}`
            ),
            location.query
          ),
        });
      } else {
        crumbs.push({
          label: t('Query Summary'),
        });
      }
      break;
    case ModuleName.RESOURCE:
      if (location.query.groupId) {
        crumbs.push({
          label: t('Asset Summary'),
          to: getBreadCrumbTarget(
            normalizeUrl(
              `/organizations/${organization.slug}/${moduleURLBuilder(moduleName)}/spans/span/${location.query.groupId}`
            ),
            location.query
          ),
        });
      } else {
        crumbs.push({
          label: t('Asset Summary'),
        });
      }
      break;
    case ModuleName.APP_START:
      crumbs.push({
        label: t('Screen Summary'),
        to: getBreadCrumbTarget(
          normalizeUrl(
            `/organizations/${organization.slug}/${moduleURLBuilder(moduleName, view)}/spans`
          ),
          location.query
        ),
      });
      break;
    case ModuleName.SCREEN_LOAD:
      crumbs.push({
        label: t('Screen Summary'),
        to: getBreadCrumbTarget(
          normalizeUrl(
            `/organizations/${organization.slug}/${moduleURLBuilder(moduleName, view)}/spans`
          ),
          location.query
        ),
      });
      break;
    case ModuleName.VITAL:
      crumbs.push({
        label: t('Page Overview'),
        to: getBreadCrumbTarget(
          normalizeUrl(
            `/organizations/${organization.slug}/${moduleURLBuilder(moduleName, view)}/overview`
          ),
          location.query
        ),
      });
      break;
    case ModuleName.QUEUE:
      crumbs.push({
        label: t('Destination Summary'),
        to: getBreadCrumbTarget(
          normalizeUrl(
            `/organizations/${organization.slug}/${moduleURLBuilder(moduleName, view)}/destination`
          ),
          location.query
        ),
      });
      break;

    case ModuleName.CACHE:
    default:
      break;
  }

  crumbs.push(leafBreadcrumb);

  return crumbs;
}

function LeafBreadCrumbLabel({
  traceSlug,
  project,
}: {
  project: Project | undefined;
  traceSlug: string;
}) {
  return (
    <Wrapper>
      {project && (
        <ProjectBadge
          hideName
          project={project}
          avatarSize={16}
          avatarProps={{
            hasTooltip: true,
            tooltip: project.slug,
          }}
        />
      )}
      <span>{formatVersion(traceSlug)}</span>
      <CopyToClipboardButton
        aria-label={t('Copy trace ID to clipboard')}
        className="trace-id-copy-button"
        text={traceSlug}
        size="zero"
        borderless
        style={{
          transform: 'translateY(-1px) translateX(-3px)',
        }}
      />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
  min-height: 24px;

  .trace-id-copy-button {
    display: none;
  }

  &:hover {
    .trace-id-copy-button {
      display: block;
    }
  }
`;

export function getTraceViewBreadcrumbs({
  organization,
  location,
  moduleURLBuilder,
  traceSlug,
  project,
  view,
}: {
  location: Location;
  moduleURLBuilder: URLBuilder;
  organization: Organization;
  traceSlug: string;
  project?: Project;
  view?: DomainView;
}): Crumb[] {
  const leafBreadcrumb: Crumb = {
    label: <LeafBreadCrumbLabel traceSlug={traceSlug} project={project} />,
  };
  if (
    typeof location.query.source === 'string' &&
    TRACE_SOURCE_TO_INSIGHTS_MODULE[
      location.query.source as keyof typeof TRACE_SOURCE_TO_INSIGHTS_MODULE
    ]
  ) {
    return getInsightsModuleBreadcrumbs(
      location,
      organization,
      moduleURLBuilder,
      leafBreadcrumb,
      view
    );
  }

  switch (location.query.source) {
    case TraceViewSources.TRACES:
      return [
        {
          label: t('Traces'),
          to: getBreadCrumbTarget(
            makeTracesPathname({path: '/', organization}),
            location.query
          ),
        },
        leafBreadcrumb,
      ];
    case TraceViewSources.DISCOVER:
      return [
        {
          label: t('Discover'),
          to: getBreadCrumbTarget(
            makeDiscoverPathname({path: '/homepage/', organization}),
            location.query
          ),
        },
        leafBreadcrumb,
      ];
    case TraceViewSources.METRICS:
      return [
        {
          label: t('Metrics'),
          to: getBreadCrumbTarget(
            normalizeUrl(`/organizations/${organization.slug}/metrics/`),
            location.query
          ),
        },
        leafBreadcrumb,
      ];
    case TraceViewSources.FEEDBACK_DETAILS:
      return [
        {
          label: t('User Feedback'),
          to: getBreadCrumbTarget(
            makeFeedbackPathname({path: '/', organization}),
            location.query
          ),
        },
        leafBreadcrumb,
      ];
    case TraceViewSources.DASHBOARDS:
      return getDashboardsBreadCrumbs(organization, location, leafBreadcrumb);
    case TraceViewSources.ISSUE_DETAILS:
      return getIssuesBreadCrumbs(organization, location, leafBreadcrumb);
    case TraceViewSources.PERFORMANCE_TRANSACTION_SUMMARY:
      return getPerformanceBreadCrumbs(organization, location, leafBreadcrumb, view);
    case TraceViewSources.LOGS:
      return [
        {
          label: t('Logs'),
          to: getBreadCrumbTarget(
            normalizeUrl(`/organizations/${organization.slug}/explore/logs/`),
            location.query
          ),
        },
        leafBreadcrumb,
      ];
    case TraceViewSources.TRACE_METRICS:
      return [
        {
          label: t('Metrics'),
          to: getBreadCrumbTarget(
            normalizeUrl(`/organizations/${organization.slug}/explore/metrics/`),
            location.query
          ),
        },
        leafBreadcrumb,
      ];
    default:
      return [
        {
          label: t('Trace'),
        },
        leafBreadcrumb,
      ];
  }
}
