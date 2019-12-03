import {Client} from 'app/api';
import {SavedIncidentRule, IncidentRule, Trigger} from './types';

function isSavedRule(rule: IncidentRule): rule is SavedIncidentRule {
  return !!rule.id;
}

/**
 * Add a new rule or update an existing rule
 *
 * @param api API Client
 * @param orgId Organization slug
 * @param rule Saved or Unsaved Metric Rule
 */
export async function addOrUpdateRule(
  api: Client,
  orgId: string,
  rule: IncidentRule
): Promise<unknown[]> {
  const isExisting = isSavedRule(rule);
  const endpoint = `/organizations/${orgId}/alert-rules/${
    isSavedRule(rule) ? `${rule.id}/` : ''
  }`;
  const method = isExisting ? 'PUT' : 'POST';

  const savedRule: SavedIncidentRule = await api.requestPromise(endpoint, {
    method,
    data: rule,
  });

  // TODO(incidents): New API endpoint should save triggers as well as actions in above endpoint
  //
  // For now save triggers and actions individually
  const triggerPromises = rule.triggers.map(
    async ({resolveThreshold, actions, ...trigger}) => {
      const triggerEndpoint = `/organizations/${orgId}/alert-rules/${
        savedRule.id
      }/triggers/${trigger.id ? `${trigger.id}/` : ''}`;
      const triggerMethod = trigger.id ? 'PUT' : 'POST';

      // Be sure to not include actions for now (we destructure from trigger in params)
      const savedTrigger = await api.requestPromise(triggerEndpoint, {
        method: triggerMethod,
        data: {
          ...trigger,
          // Note `resolveThreshold can be empty string, but need to remove it for API
          ...(resolveThreshold !== '' ? {resolveThreshold} : {}),
        },
      });

      return await Promise.all(
        actions.map(action => {
          const actionsEndpoint = `/organizations/${orgId}/alert-rules/${
            savedRule.id
          }/triggers/${savedTrigger.id}/actions/${action.id ? `${action.id}/` : ''}`;
          const actionsMethod = action.id ? 'PUT' : 'POST';

          return api.requestPromise(actionsEndpoint, {
            method: actionsMethod,
            data: action,
          });
        })
      );
    }
  );

  return Promise.all(triggerPromises);
}

/**
 * Delete an existing rule
 *
 * @param api API Client
 * @param orgId Organization slug
 * @param rule Saved or Unsaved Metric Rule
 */
export function deleteRule(
  api: Client,
  orgId: string,
  rule: SavedIncidentRule
): Promise<void> {
  return api.requestPromise(`/organizations/${orgId}/alert-rules/${rule.id}/`, {
    method: 'DELETE',
  });
}

export function deleteTrigger(
  api: Client,
  orgId: string,
  trigger: Trigger
): Promise<void> {
  return api.requestPromise(
    `/organizations/${orgId}/alert-rules/${trigger.alertRuleId}/triggers/${trigger.id}`,
    {
      method: 'DELETE',
    }
  );
}
