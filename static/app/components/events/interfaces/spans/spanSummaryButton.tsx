import {LinkButton} from 'sentry/components/button';
import type {SpanType} from 'sentry/components/events/interfaces/spans/types';
import {t, tct} from 'sentry/locale';
import type {EventTransaction, Organization} from 'sentry/types';
import {useLocation} from 'sentry/utils/useLocation';
import {
  DATA_TYPE as RESOURCE_DATA_TYPE,
  PERFORMANCE_DATA_TYPE as PERFORMANCE_RESOURCE_DATA_TYPE,
} from 'sentry/views/performance/browser/resources/settings';
import {
  querySummaryRouteWithQuery,
  resourceSummaryRouteWithQuery,
} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';
import {useModuleURL} from 'sentry/views/performance/utils/useModuleURL';
import {ModuleName} from 'sentry/views/starfish/types';
import {resolveSpanModule} from 'sentry/views/starfish/utils/resolveSpanModule';

interface Props {
  event: Readonly<EventTransaction>;
  organization: Organization;
  span: SpanType;
}

function SpanSummaryButton(props: Props) {
  const location = useLocation();
  const resourceBaseUrl = useModuleURL(ModuleName.RESOURCE);

  const {event, organization, span} = props;

  const sentryTags = span.sentry_tags;
  if (!sentryTags || !sentryTags.group) {
    return null;
  }

  const resolvedModule = resolveSpanModule(sentryTags.op, sentryTags.category);
  const isInsightsEnabled = organization.features.includes('performance-insights');

  const resourceDataType = isInsightsEnabled
    ? RESOURCE_DATA_TYPE
    : PERFORMANCE_RESOURCE_DATA_TYPE;

  if (
    organization.features.includes('insights-initial-modules') &&
    resolvedModule === ModuleName.DB
  ) {
    return (
      <LinkButton
        size="xs"
        to={querySummaryRouteWithQuery({
          orgSlug: organization.slug,
          query: location.query,
          group: sentryTags.group,
          projectID: event.projectID,
        })}
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
      >
        {tct('View [dataType] Summary', {dataType: resourceDataType})}
      </LinkButton>
    );
  }

  return null;
}

const resourceSummaryAvailable = (op: string = '') =>
  ['resource.script', 'resource.css'].includes(op);

export default SpanSummaryButton;
