import type {Organization} from 'sentry/types/organization';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';

/**
 * Path to the monitoring providers settings page.
 */
export function monitoringProvidersSettingsPath(organization: Organization) {
  return normalizeUrl(`/settings/${organization.slug}/seer/connectors/`);
}
