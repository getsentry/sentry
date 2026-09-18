import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {UptimeRule} from 'sentry/views/detectors/components/uptime/types';

export async function deleteUptimeRule(
  api: Client,
  org: Organization,
  uptimeRule: UptimeRule
) {
  addLoadingMessage('Deleting uptime alert rule...');

  try {
    await api.requestPromise(
      getApiUrl(
        '/projects/$organizationIdOrSlug/$projectIdOrSlug/uptime/$uptimeDetectorId/',
        {
          path: {
            organizationIdOrSlug: org.slug,
            projectIdOrSlug: uptimeRule.projectSlug,
            uptimeDetectorId: uptimeRule.id,
          },
        }
      ),
      {
        method: 'DELETE',
      }
    );
    clearIndicators();
  } catch (_err) {
    addErrorMessage(t('Error deleting rule'));
  }
}
