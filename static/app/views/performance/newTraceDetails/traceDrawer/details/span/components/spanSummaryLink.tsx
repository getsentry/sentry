import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import {IconGraph} from 'sentry/icons/iconGraph';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {resolveSpanModule} from 'sentry/views/insights/common/utils/resolveSpanModule';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {ModuleName} from 'sentry/views/insights/types';
import {
  querySummaryRouteWithQuery,
  resourceSummaryRouteWithQuery,
} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';

interface Props {
  category: string | undefined;
  group: string | undefined;
  op: string | undefined;
  organization: Organization;
  project_id: string | undefined;
}

function SpanSummaryLink(props: Props) {
  const location = useLocation();
  const resourceBaseUrl = useModuleURL(ModuleName.RESOURCE);
  const queryBaseUrl = useModuleURL(ModuleName.DB);

  if (!props.group) {
    return null;
  }

  const resolvedModule = resolveSpanModule(props.op, props.category);

  if (
    props.organization.features.includes('insights-initial-modules') &&
    resolvedModule === ModuleName.DB
  ) {
    return (
      <Link
        to={querySummaryRouteWithQuery({
          base: queryBaseUrl,
          query: location.query,
          group: props.group,
          projectID: props.project_id,
        })}
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
    props.organization.features.includes('insights-initial-modules') &&
    resolvedModule === ModuleName.RESOURCE &&
    resourceSummaryAvailable(props.op)
  ) {
    return (
      <Link
        to={resourceSummaryRouteWithQuery({
          baseUrl: resourceBaseUrl,
          query: location.query,
          group: props.group,
          projectID: props.project_id,
        })}
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
  margin-right: ${space(0.5)};
`;

const resourceSummaryAvailable = (op = '') =>
  ['resource.script', 'resource.css'].includes(op);

export default SpanSummaryLink;
