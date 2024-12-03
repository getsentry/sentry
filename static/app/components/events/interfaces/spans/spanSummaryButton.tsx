import {LinkButton} from 'sentry/components/button';
import type {SpanType} from 'sentry/components/events/interfaces/spans/types';
import {t, tct} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {DATA_TYPE} from 'sentry/views/insights/browser/resources/settings';
import {resolveSpanModule} from 'sentry/views/insights/common/utils/resolveSpanModule';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {ModuleName} from 'sentry/views/insights/types';
import {
  querySummaryRouteWithQuery,
  resourceSummaryRouteWithQuery,
} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';

interface Props {
  event: Readonly<EventTransaction>;
  organization: Organization;
  span: SpanType;
}

function SpanSummaryButton(props: Props) {
  const location = useLocation();
  const resourceBaseUrl = useModuleURL(ModuleName.RESOURCE);
  const queryBaseUrl = useModuleURL(ModuleName.DB);

  const {event, organization, span} = props;

  const sentryTags = span.sentry_tags;
  if (!sentryTags || !sentryTags.group) {
    return null;
  }

  const resolvedModule = resolveSpanModule(sentryTags.op, sentryTags.category);

  if (
    organization.features.includes('insights-initial-modules') &&
    resolvedModule === ModuleName.DB
  ) {
    return (
      <LinkButton
        size="xs"
        to={querySummaryRouteWithQuery({
          base: queryBaseUrl,
          query: location.query,
          group: sentryTags.group,
          projectID: event.projectID,
        })}
        onClick={() => {
          trackAnalytics('trace.trace_layout.view_in_insight_module', {
            organization,
            module: ModuleName.DB,
          });
        }}
      >
        {t('View Query Summary')}
      </LinkButton>
    );
  }

  if (
    organization.features.includes('insights-initial-modules') &&
    resolvedModule === ModuleName.RESOURCE &&
    resourceSummaryAvailable(sentryTags.op)
  ) {
    return (
      <LinkButton
        size="xs"
        to={resourceSummaryRouteWithQuery({
          baseUrl: resourceBaseUrl,
          query: location.query,
          group: sentryTags.group,
          projectID: event.projectID,
        })}
        onClick={() => {
          trackAnalytics('trace.trace_layout.view_in_insight_module', {
            organization,
            module: ModuleName.RESOURCE,
          });
        }}
      >
        {tct('View [dataType] Summary', {dataType: DATA_TYPE})}
      </LinkButton>
    );
  }

  return null;
}

const resourceSummaryAvailable = (op: string = '') =>
  ['resource.script', 'resource.css'].includes(op);

export default SpanSummaryButton;
