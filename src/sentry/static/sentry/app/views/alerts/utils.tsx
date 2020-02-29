import {AlertRuleAggregations} from 'app/views/settings/incidentRules/types';
import {Client} from 'app/api';
import {t} from 'app/locale';

import {Incident, IncidentStatus} from './types';

export function fetchIncident(
  api: Client,
  orgId: string,
  alertId: string
): Promise<Incident> {
  return api.requestPromise(`/organizations/${orgId}/incidents/${alertId}/`);
}

export function updateSubscription(
  api: Client,
  orgId: string,
  alertId: string,
  isSubscribed?: boolean
): Promise<Incident> {
  const method = isSubscribed ? 'POST' : 'DELETE';
  return api.requestPromise(
    `/organizations/${orgId}/incidents/${alertId}/subscriptions/`,
    {
      method,
    }
  );
}

export function updateStatus(
  api: Client,
  orgId: string,
  alertId: string,
  status: IncidentStatus
): Promise<Incident> {
  return api.requestPromise(`/organizations/${orgId}/incidents/${alertId}/`, {
    method: 'PUT',
    data: {
      status,
    },
  });
}

/**
 * Is incident open?
 *
 * @param {Object} incident Incident object
 * @returns {Boolean}
 */

export function isOpen(incident: Incident): boolean {
  switch (incident.status) {
    case IncidentStatus.CLOSED:
      return false;
    default:
      return true;
  }
}

/**
 * Get display string based on alert rule aggregation type
 */
export function getDisplayForAlertRuleAggregation(aggregation: AlertRuleAggregations) {
  return aggregation === AlertRuleAggregations.TOTAL ? t('Events') : t('Users');
}
