import {useCallback} from 'react';
import type {Location} from 'history';
import omit from 'lodash/omit';

import type {Crumb} from 'sentry/components/breadcrumbs';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import DiscoverButton from 'sentry/components/discoverButton';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import TraceConfigurations from 'sentry/views/performance/newTraceDetails/traceConfigurations';

import Tab from '../transactionSummary/tabs';

interface TraceMetadataHeaderProps {
  organization: Organization;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  traceEventView: EventView;
  traceSlug: string;
}

export const enum TraceViewSources {
  TRACES = 'traces',
  METRICS = 'metrics',
  DISCOVER = 'discover',
  REQUESTS_MODULE = 'requests_module',
  QUERIES_MODULE = 'queries_module',
  ASSETS_MODULE = 'assets_module',
  APP_STARTS_MODULE = 'app_starts_module',
  SCREEN_LOADS_MODULE = 'screen_loads_module',
  WEB_VITALS_MODULE = 'web_vitals_module',
  CACHES_MODULE = 'caches_module',
  QUEUES_MODULE = 'queues_module',
  PERFORMANCE_TRANSACTION_SUMMARY = 'performance_transaction_summary',
  PERFORMANCE_TRANSACTION_SUMMARY_PROFILES = 'performance_transaction_summary_profiles',
  ISSUE_DETAILS = 'issue_details',
}

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

function getPerformanceBreadCrumbs(organization: Organization, location: Location) {
  const crumbs: Crumb[] = [];

  crumbs.push({
    label: t('Performance'),
    to: getBreadCrumbTarget(`performance`, location.query, organization),
  });

  switch (location.query.tab) {
    case Tab.EVENTS:
      crumbs.push({
        label: t('All Events'),
        to: getBreadCrumbTarget(
          `performance/summary/events`,
          location.query,
          organization
        ),
      });
      break;
    case Tab.TAGS:
      crumbs.push({
        label: t('Tags'),
        to: getBreadCrumbTarget(`performance/summary/tags`, location.query, organization),
      });
      break;
    case Tab.SPANS:
      crumbs.push({
        label: t('Spans'),
        to: getBreadCrumbTarget(
          `performance/summary/spans`,
          location.query,
          organization
        ),
      });

      const {spanSlug} = location.query;
      if (spanSlug) {
        crumbs.push({
          label: t('Span Summary'),
          to: getBreadCrumbTarget(
            `performance/summary/spans/${spanSlug}`,
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
          `performance/summary/aggregateWaterfall`,
          location.query,
          organization
        ),
      });
      break;
    default:
      crumbs.push({
        label: t('Transaction Summary'),
        to: getBreadCrumbTarget(`performance/summary`, location.query, organization),
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

function getInsightsModuleBreadcrumbs(location: Location, organization: Organization) {
  const crumbs: Crumb[] = [];

  crumbs.push({
    label: t('Insights'),
  });

  switch (location.query.source) {
    case TraceViewSources.REQUESTS_MODULE:
      crumbs.push({
        label: t('Requests'),
        to: getBreadCrumbTarget(`insights/http/`, location.query, organization),
      });

      crumbs.push({
        label: t('Domain Summary'),
        to: getBreadCrumbTarget(`insights/http/domains/`, location.query, organization),
      });
      break;
    case TraceViewSources.QUERIES_MODULE:
      crumbs.push({
        label: t('Queries'),
        to: getBreadCrumbTarget(`insights/database`, location.query, organization),
      });

      if (location.query.groupId) {
        crumbs.push({
          label: t('Query Summary'),
          to: getBreadCrumbTarget(
            `insights/database/spans/span/${location.query.groupId}`,
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
    case TraceViewSources.ASSETS_MODULE:
      crumbs.push({
        label: t('Assets'),
        to: getBreadCrumbTarget(`insights/browser/assets`, location.query, organization),
      });

      if (location.query.groupId) {
        crumbs.push({
          label: t('Asset Summary'),
          to: getBreadCrumbTarget(
            `insights/browser/assets/spans/span/${location.query.groupId}`,
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
    case TraceViewSources.APP_STARTS_MODULE:
      crumbs.push({
        label: t('App Starts'),
        to: getBreadCrumbTarget(
          `insights/mobile/app-startup`,
          location.query,
          organization
        ),
      });

      crumbs.push({
        label: t('Screen Summary'),
        to: getBreadCrumbTarget(
          `mobile/app-startup/spans/`,
          location.query,
          organization
        ),
      });
      break;
    case TraceViewSources.SCREEN_LOADS_MODULE:
      crumbs.push({
        label: t('Screen Loads'),
        to: getBreadCrumbTarget(`insights/mobile/screens`, location.query, organization),
      });

      crumbs.push({
        label: t('Screen Summary'),
        to: getBreadCrumbTarget(
          `insights/mobile/screens/spans`,
          location.query,
          organization
        ),
      });
      break;
    case TraceViewSources.WEB_VITALS_MODULE:
      crumbs.push({
        label: t('Web Vitals'),
        to: getBreadCrumbTarget(
          `insights/browser/pageloads`,
          location.query,
          organization
        ),
      });

      crumbs.push({
        label: t('Page Overview'),
        to: getBreadCrumbTarget(
          `insights/browser/pageloads/overview`,
          location.query,
          organization
        ),
      });
      break;
    case TraceViewSources.CACHES_MODULE:
      crumbs.push({
        label: t('Caches'),
        to: getBreadCrumbTarget(`insights/caches`, location.query, organization),
      });
      break;
    case TraceViewSources.QUEUES_MODULE:
      crumbs.push({
        label: t('Queues'),
        to: getBreadCrumbTarget(`insights/queues`, location.query, organization),
      });

      crumbs.push({
        label: t('Destination Summary'),
        to: getBreadCrumbTarget(
          `insights/queues/destination`,
          location.query,
          organization
        ),
      });
      break;
    default:
      break;
  }

  crumbs.push({
    label: t('Trace View'),
  });

  return crumbs;
}

function getTraceViewBreadcrumbs(
  organization: Organization,
  location: Location
): Crumb[] {
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
      return getPerformanceBreadCrumbs(organization, location);
    case TraceViewSources.REQUESTS_MODULE:
    case TraceViewSources.QUERIES_MODULE:
    case TraceViewSources.ASSETS_MODULE:
    case TraceViewSources.APP_STARTS_MODULE:
    case TraceViewSources.SCREEN_LOADS_MODULE:
    case TraceViewSources.WEB_VITALS_MODULE:
    case TraceViewSources.CACHES_MODULE:
    case TraceViewSources.QUEUES_MODULE:
      return getInsightsModuleBreadcrumbs(location, organization);
    default:
      return [{label: t('Trace View')}];
  }
}

export function TraceMetadataHeader(props: TraceMetadataHeaderProps) {
  const location = useLocation();

  const trackOpenInDiscover = useCallback(() => {
    trackAnalytics('performance_views.trace_view.open_in_discover', {
      organization: props.organization,
    });
  }, [props.organization]);

  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <Breadcrumbs crumbs={getTraceViewBreadcrumbs(props.organization, location)} />
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <ButtonBar gap={1}>
          <TraceConfigurations rootEventResults={props.rootEventResults} />
          <DiscoverButton
            size="sm"
            to={props.traceEventView.getResultsViewUrlTarget(
              props.organization.slug,
              false,
              hasDatasetSelector(props.organization)
                ? SavedQueryDatasets.ERRORS
                : undefined
            )}
            onClick={trackOpenInDiscover}
          >
            {t('Open in Discover')}
          </DiscoverButton>

          <FeedbackWidgetButton />
        </ButtonBar>
      </Layout.HeaderActions>
    </Layout.Header>
  );
}
