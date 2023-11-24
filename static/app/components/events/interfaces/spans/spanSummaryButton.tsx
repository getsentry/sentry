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

  if (
    organization.features.includes('performance-database-view') &&
    resolveSpanModule(span.sentry_tags?.op, span.sentry_tags?.category) ===
      ModuleName.DB &&
    span.sentry_tags?.group
  ) {
    return (
      <LinkButton
        size="xs"
        to={querySummaryRouteWithQuery({
          orgSlug: organization.slug,
          query: location.query,
          group: span.sentry_tags.group,
          projectID: event.projectID,
        })}
      >
        {t('View Query Summary')}
      </LinkButton>
    );
  }

  if (
    organization.features.includes('starfish-browser-resource-module-ui') &&
    resolveSpanModule(span.sentry_tags?.op, span.sentry_tags?.category) ===
      ModuleName.RESOURCE &&
    span.sentry_tags?.group
  ) {
    return (
      <LinkButton
        size="xs"
        to={resourceSummaryRouteWithQuery({
          orgSlug: organization.slug,
          query: location.query,
          group: span.sentry_tags.group,
          projectID: event.projectID,
        })}
      >
        {t('View Resource Summary')}
      </LinkButton>
    );
  }

  return null;
}

export default SpanSummaryButton;
