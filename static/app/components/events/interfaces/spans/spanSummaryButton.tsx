import {LinkButton} from 'sentry/components/button';
import {SpanType} from 'sentry/components/events/interfaces/spans/types';
import {t} from 'sentry/locale';
import {EventTransaction, Organization} from 'sentry/types';
import {useLocation} from 'sentry/utils/useLocation';
import {
  querySummaryRouteWithQuery,
  resourceSummaryRouteWithQuery,
} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';
import {ModuleName} from 'sentry/views/starfish/types';
import {resolveSpanModule} from 'sentry/views/starfish/utils/resolveSpanModule';

interface Props {
  event: Readonly<EventTransaction>;
  organization: Organization;
  span: SpanType;
}

function SpanSummaryButton(props: Props) {
  const location = useLocation();

  const {event, organization, span} = props;

  const sentryTags = span.sentry_tags;
  if (!sentryTags || !sentryTags.group) {
    return null;
  }

  const resolvedModule = resolveSpanModule(sentryTags.op, sentryTags.category);

  if (
    organization.features.includes('performance-database-view') &&
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
    organization.features.includes('starfish-browser-resource-module-ui') &&
    resolvedModule === ModuleName.RESOURCE &&
    resourceSummaryAvailable(sentryTags.op)
  ) {
    return (
      <LinkButton
        size="xs"
        to={resourceSummaryRouteWithQuery({
          orgSlug: organization.slug,
          query: location.query,
          group: sentryTags.group,
          projectID: event.projectID,
        })}
      >
        {t('View Resource Summary')}
      </LinkButton>
    );
  }

  return null;
}

const resourceSummaryAvailable = (op: string = '') =>
  ['resource.script', 'resource.css'].includes(op);

export default SpanSummaryButton;
