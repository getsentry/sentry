import styled from '@emotion/styled';

import {Link} from '@sentry/scraps/link';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {IconGraph} from 'sentry/icons/iconGraph';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {resolveSpanModule} from 'sentry/views/insights/common/utils/resolveSpanModule';
import {hasPlatformizedInsights} from 'sentry/views/insights/common/utils/useHasPlatformizedInsights';
import {usePrebuiltDashboardUrlOrModuleUrl} from 'sentry/views/insights/common/utils/useModuleURL';
import {ModuleName} from 'sentry/views/insights/types';
import {
  querySummaryRouteWithQuery,
  resourceSummaryRouteWithQuery,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/components/utils';

interface Props {
  category: string | undefined;
  group: string | undefined;
  op: string | undefined;
  organization: Organization;
  project_id: string | undefined;
}

export function SpanSummaryLink(props: Props) {
  const location = useLocation();
  const {selection} = usePageFilters();
  const isPlatformized = hasPlatformizedInsights(props.organization);
  const pageFilters = {
    project: selection.projects,
    environment: selection.environments,
    statsPeriod: selection.datetime.period ?? undefined,
    start: selection.datetime.start?.toString() ?? undefined,
    end: selection.datetime.end?.toString() ?? undefined,
  };
  const resourceBaseUrl = usePrebuiltDashboardUrlOrModuleUrl(
    PrebuiltDashboardId.FRONTEND_ASSETS_SUMMARY,
    {pageFilters}
  );
  const queryBaseUrl = usePrebuiltDashboardUrlOrModuleUrl(
    PrebuiltDashboardId.BACKEND_QUERIES_SUMMARY,
    {pageFilters}
  );

  if (!props.group) {
    return null;
  }

  const resolvedModule = resolveSpanModule(props.op, props.category);

  if (
    props.organization.features.includes('insight-modules') &&
    resolvedModule === ModuleName.DB
  ) {
    const target = isPlatformized
      ? queryBaseUrl
      : querySummaryRouteWithQuery({
          base: queryBaseUrl,
          query: location.query,
          group: props.group,
          projectID: props.project_id,
        });

    return (
      <Link
        to={target}
        onClick={() => {
          trackAnalytics('trace.trace_layout.view_in_insight_module', {
            organization: props.organization,
            module: ModuleName.DB,
          });
        }}
      >
        <StyledIconGraph type="area" size="xs" />
        {t('View Summary')}
      </Link>
    );
  }

  if (
    props.organization.features.includes('insight-modules') &&
    resolvedModule === ModuleName.RESOURCE &&
    resourceSummaryAvailable(props.op)
  ) {
    const target = isPlatformized
      ? resourceBaseUrl
      : resourceSummaryRouteWithQuery({
          baseUrl: resourceBaseUrl,
          query: location.query,
          group: props.group,
          projectID: props.project_id,
        });

    return (
      <Link
        to={target}
        onClick={() => {
          trackAnalytics('trace.trace_layout.view_in_insight_module', {
            organization: props.organization,
            module: ModuleName.RESOURCE,
          });
        }}
      >
        <StyledIconGraph size="xs" />
        {t('View Summary')}
      </Link>
    );
  }

  return null;
}

const StyledIconGraph = styled(IconGraph)`
  margin-right: ${p => p.theme.space.xs};
`;

const resourceSummaryAvailable = (op = '') =>
  ['resource.script', 'resource.css'].includes(op);
