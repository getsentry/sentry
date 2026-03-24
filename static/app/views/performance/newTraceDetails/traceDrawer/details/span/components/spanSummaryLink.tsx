import styled from '@emotion/styled';

import {Link} from '@sentry/scraps/link';

import {IconGraph} from 'sentry/icons/iconGraph';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {FieldKind} from 'sentry/utils/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {WidgetType} from 'sentry/views/dashboards/types';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {usePrebuiltDashboardUrl} from 'sentry/views/dashboards/utils/usePrebuiltDashboardUrl';
import {resolveSpanModule} from 'sentry/views/insights/common/utils/resolveSpanModule';
import {hasPlatformizedInsights} from 'sentry/views/insights/common/utils/useHasPlatformizedInsights';
import { useModuleURL } from 'sentry/views/insights/common/utils/useModuleURL';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';
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
  const resourceBaseUrl = useModuleURL(ModuleName.RESOURCE);
  const queryBaseUrl = useModuleURL(ModuleName.DB);

  const isPlatformized = hasPlatformizedInsights(props.organization);
  const spanGroupFilter = props.group
    ? {
        globalFilter: [
          {
            dataset: WidgetType.SPANS,
            tag: {
              key: SpanFields.SPAN_GROUP,
              name: SpanFields.SPAN_GROUP,
              kind: FieldKind.TAG,
            },
            value: `${SpanFields.SPAN_GROUP}:[${props.group}]`,
          },
        ],
      }
    : undefined;
  const platformizedResourceUrl = usePrebuiltDashboardUrl(
    PrebuiltDashboardId.FRONTEND_ASSETS_SUMMARY,
    {filters: spanGroupFilter}
  );
  const platformizedQueryUrl = usePrebuiltDashboardUrl(
    PrebuiltDashboardId.BACKEND_QUERIES_SUMMARY,
    {filters: spanGroupFilter}
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
      ? platformizedQueryUrl
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
      ? platformizedResourceUrl
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
