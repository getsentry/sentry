import type {Location} from 'history';
import omit from 'lodash/omit';

import type {Crumb} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
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
import {MODULE_TITLES} from 'sentry/views/insights/settings';
import {ModuleName} from 'sentry/views/insights/types';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';
import {getPerformanceBaseUrl} from 'sentry/views/performance/utils';

import Tab from '../../transactionSummary/tabs';

export const enum TraceViewSources {
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
  PERFORMANCE_TRANSACTION_SUMMARY_PROFILES = 'performance_transaction_summary_profiles',
  ISSUE_DETAILS = 'issue_details',
  FEEDBACK_DETAILS = 'feedback_details',
}

// Ideally every new entry to ModuleName, would require a new source to be added here so we don't miss any.
const TRACE_SOURCE_TO_MODULE: Partial<Record<TraceViewSources, ModuleName>> = {
  app_starts_module: ModuleName.APP_START,
  assets_module: ModuleName.RESOURCE,
  caches_module: ModuleName.CACHE,
  llm_module: ModuleName.AI,
  queries_module: ModuleName.DB,
  requests_module: ModuleName.HTTP,
  screen_loads_module: ModuleName.SCREEN_LOAD,
  web_vitals_module: ModuleName.VITAL,
  queues_module: ModuleName.QUEUE,
  screen_load_module: ModuleName.SCREEN_LOAD,
  screen_rendering_module: ModuleName.SCREEN_RENDERING,
  mobile_screens_module: ModuleName.MOBILE_SCREENS,
};

function getBreadCrumbTarget(
  path: string,
  query: Location['query'],
  organization: Organization
) {
  return {
    pathname: normalizeUrl(`/organizations/${organization.slug}/${path}`),
    // Remove traceView specific query parameters that are not needed when navigating back.
    query: {...omit(query, ['node', 'fov', 'timestamp', 'eventId'])},
  };
}

function getPerformanceBreadCrumbs(
  organization: Organization,
  location: Location,
  view?: DomainView
) {
  const crumbs: Crumb[] = [];

  const performanceUrl = getPerformanceBaseUrl(organization.slug, view, true);
  const transactionSummaryUrl = getTransactionSummaryBaseUrl(
    organization.slug,
    view,
    true
  );

  crumbs.push({
    label: (view && DOMAIN_VIEW_TITLES[view]) || t('Performance'),
    to: getBreadCrumbTarget(performanceUrl, location.query, organization),
  });

  switch (location.query.tab) {
    case Tab.EVENTS:
      crumbs.push({
        label: t('Transaction Summary'),
        to: getBreadCrumbTarget(`${transactionSummaryUrl}`, location.query, organization),
      });
      break;
    case Tab.TAGS:
      crumbs.push({
        label: t('Tags'),
        to: getBreadCrumbTarget(
          `${transactionSummaryUrl}/tags`,
          location.query,
          organization
        ),
      });
      break;
    case Tab.SPANS:
      crumbs.push({
        label: t('Spans'),
        to: getBreadCrumbTarget(
          `${transactionSummaryUrl}/spans`,
          location.query,
          organization
        ),
      });

      const {spanSlug} = location.query;
      if (spanSlug) {
        crumbs.push({
          label: t('Span Summary'),
          to: getBreadCrumbTarget(
            `${transactionSummaryUrl}/spans/${spanSlug}`,
            location.query,
            organization
          ),
        });
      }
      break;
    case Tab.AGGREGATE_WATERFALL:
      crumbs.push({
        label: t('Transaction Summary'),
        to: getBreadCrumbTarget(
          `${transactionSummaryUrl}/aggregateWaterfall`,
          location.query,
          organization
        ),
      });
      break;
    default:
      crumbs.push({
        label: t('Transaction Summary'),
        to: getBreadCrumbTarget(`${transactionSummaryUrl}`, location.query, organization),
      });
      break;
  }

  crumbs.push({
    label: t('Trace View'),
  });

  return crumbs;
}

function getIssuesBreadCrumbs(organization: Organization, location: Location) {
  const crumbs: Crumb[] = [];

  crumbs.push({
    label: t('Issues'),
    to: getBreadCrumbTarget(`issues`, location.query, organization),
  });

  if (location.query.groupId) {
    crumbs.push({
      label: t('Issue Details'),
      to: getBreadCrumbTarget(
        `issues/${location.query.groupId}`,
        location.query,
        organization
      ),
    });
  }

  crumbs.push({
    label: t('Trace View'),
  });

  return crumbs;
}

function getInsightsModuleBreadcrumbs(
  location: Location,
  organization: Organization,
  moduleURLBuilder: URLBuilder,
  view?: DomainView
) {
  const crumbs: Crumb[] = [];

  if (view && DOMAIN_VIEW_TITLES[view]) {
    crumbs.push({
      label: DOMAIN_VIEW_BASE_TITLE,
      to: undefined,
    });
    crumbs.push({
      label: DOMAIN_VIEW_TITLES[view],
      to: getBreadCrumbTarget(
        `${DOMAIN_VIEW_BASE_URL}/${view}/`,
        location.query,
        organization
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
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    TRACE_SOURCE_TO_MODULE[location.query.source]
  ) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    moduleName = TRACE_SOURCE_TO_MODULE[location.query.source] as RoutableModuleNames;
    crumbs.push({
      label: MODULE_TITLES[moduleName],
      to: getBreadCrumbTarget(
        `${moduleURLBuilder(moduleName, view)}/`,
        location.query,
        organization
      ),
    });
  }

  switch (moduleName) {
    case ModuleName.HTTP:
      crumbs.push({
        label: t('Domain Summary'),
        to: getBreadCrumbTarget(
          `${moduleURLBuilder(moduleName, view)}/domains`,
          location.query,
          organization
        ),
      });
      break;
    case ModuleName.DB:
      if (location.query.groupId) {
        crumbs.push({
          label: t('Query Summary'),
          to: getBreadCrumbTarget(
            `${moduleURLBuilder(moduleName, view)}/spans/span/${location.query.groupId}`,
            location.query,
            organization
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
            `${moduleURLBuilder(moduleName)}/spans/span/${location.query.groupId}`,
            location.query,
            organization
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
          `${moduleURLBuilder(moduleName, view)}/spans`,
          location.query,
          organization
        ),
      });
      break;
    case ModuleName.SCREEN_LOAD:
      crumbs.push({
        label: t('Screen Summary'),
        to: getBreadCrumbTarget(
          `${moduleURLBuilder(moduleName, view)}/spans`,
          location.query,
          organization
        ),
      });
      break;
    case ModuleName.VITAL:
      crumbs.push({
        label: t('Page Overview'),
        to: getBreadCrumbTarget(
          `${moduleURLBuilder(moduleName, view)}/overview`,
          location.query,
          organization
        ),
      });
      break;
    case ModuleName.QUEUE:
      crumbs.push({
        label: t('Destination Summary'),
        to: getBreadCrumbTarget(
          `${moduleURLBuilder(moduleName, view)}/destination`,
          location.query,
          organization
        ),
      });
      break;
    case ModuleName.AI:
      if (location.query.groupId) {
        crumbs.push({
          label: t('Pipeline Summary'),
          to: getBreadCrumbTarget(
            `${moduleURLBuilder(moduleName, view)}/pipeline-type/${location.query.groupId}`,
            location.query,
            organization
          ),
        });
      }
      break;
    case ModuleName.CACHE:
    default:
      break;
  }

  crumbs.push({
    label: t('Trace View'),
  });

  return crumbs;
}

export function getTraceViewBreadcrumbs(
  organization: Organization,
  location: Location,
  moduleUrlBuilder: URLBuilder,
  view?: DomainView
): Crumb[] {
  if (
    typeof location.query.source === 'string' &&
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    TRACE_SOURCE_TO_MODULE[location.query.source]
  ) {
    return getInsightsModuleBreadcrumbs(location, organization, moduleUrlBuilder, view);
  }

  switch (location.query.source) {
    case TraceViewSources.TRACES:
      return [
        {
          label: t('Traces'),
          to: getBreadCrumbTarget(`traces`, location.query, organization),
        },
        {
          label: t('Trace View'),
        },
      ];
    case TraceViewSources.DISCOVER:
      return [
        {
          label: t('Discover'),
          to: getBreadCrumbTarget(`discover/homepage`, location.query, organization),
        },
        {
          label: t('Trace View'),
        },
      ];
    case TraceViewSources.METRICS:
      return [
        {
          label: t('Metrics'),
          to: getBreadCrumbTarget(`metrics`, location.query, organization),
        },
        {
          label: t('Trace View'),
        },
      ];
    case TraceViewSources.ISSUE_DETAILS:
      return getIssuesBreadCrumbs(organization, location);
    case TraceViewSources.PERFORMANCE_TRANSACTION_SUMMARY:
      return getPerformanceBreadCrumbs(organization, location, view);
    default:
      return [{label: t('Trace View')}];
  }
}
