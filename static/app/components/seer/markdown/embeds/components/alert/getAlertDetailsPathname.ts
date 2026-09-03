import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import type {Organization} from 'sentry/types/organization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {makeAutomationDetailsPathname} from 'sentry/views/automations/pathnames';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';

export function getAlertDetailsPathname(
  organization: Organization,
  {id, detectorId, kind}: EmbedOutput<'alert'>
) {
  if (kind === 'issue') {
    return makeAutomationDetailsPathname(organization.slug, id);
  }

  if (kind === 'metric' && !detectorId) {
    return makeAlertsPathname({organization, path: `/rules/details/${id}/`});
  }

  return makeMonitorDetailsPathname(organization.slug, detectorId ?? id);
}
