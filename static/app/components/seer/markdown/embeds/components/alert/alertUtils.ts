import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import type {Organization} from 'sentry/types/organization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {makeAutomationDetailsPathname} from 'sentry/views/automations/pathnames';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';

type AlertEmbed = EmbedOutput<'alert'>;

/**
 * The detector id to load this alert's configuration from, when the embed
 * carries one that is safe to use.
 *
 * `id` and `detectorId` are only interchangeable for uptime alerts, which the
 * workflow engine models as detectors natively -- there is no separate legacy
 * id space for them. A metric alert's `id` is an `AlertRule` id and a cron
 * alert's is a `Monitor` GUID; both belong to their own id space, so treating
 * either as a detector id loads the wrong monitor or none at all.
 */
export function getEmbeddedDetectorId({
  id,
  kind,
  detectorId,
}: AlertEmbed): string | undefined {
  if (detectorId) {
    return detectorId;
  }

  return kind === 'uptime' ? id : undefined;
}

/**
 * A detector-backed alert that the embed cannot point at a detector on its own.
 * Whether that is recoverable depends on the kind -- see `canResolveDetectorId`.
 */
function isLegacyAlert(alert: AlertEmbed): boolean {
  return alert.kind !== 'issue' && !getEmbeddedDetectorId(alert);
}

/**
 * A legacy metric alert can be translated into its detector at runtime, but
 * only for a numeric `AlertRule` id -- the lookup endpoint validates
 * `alert_rule_id` as an integer and rejects anything else.
 */
export function canResolveDetectorId(alert: AlertEmbed): boolean {
  return alert.kind === 'metric' && isLegacyAlert(alert) && /^\d+$/.test(alert.id);
}

/**
 * Where the alert's own detail page lives. Returns `undefined` when the embed
 * carries nothing that resolves to a page, so the caller can render the alert
 * unlinked rather than link somewhere that 404s.
 */
export function getAlertDetailsPathname(
  organization: Organization,
  alert: AlertEmbed
): string | undefined {
  const {id, kind} = alert;

  if (kind === 'issue') {
    return makeAutomationDetailsPathname(organization.slug, id);
  }

  const detectorId = getEmbeddedDetectorId(alert);
  if (detectorId) {
    return makeMonitorDetailsPathname(organization.slug, detectorId);
  }

  if (kind === 'metric') {
    // The legacy details route still resolves an `AlertRule` id, and redirects
    // onto the monitor page itself for orgs already on the workflow engine.
    return makeAlertsPathname({organization, path: `/rules/details/${id}/`});
  }

  // A legacy cron alert's `id` is a `Monitor` GUID. Its details route is
  // project-scoped and the embed carries no project, so there is no link to
  // build -- the monitors route would 404 on the GUID.
  return undefined;
}
