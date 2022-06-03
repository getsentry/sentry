import {addErrorMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {NoteType} from 'sentry/types/alerts';

/**
 * Fetches a list of activities for an incident
 */
export function fetchIncidentActivities(api: Client, orgId: string, alertId: string) {
  return api.requestPromise(`/organizations/${orgId}/incidents/${alertId}/activity/`);
}

/**
 * Creates a note for an incident
 */
export async function createIncidentNote(
  api: Client,
  orgId: string,
  alertId: string,
  note: NoteType
) {
  try {
    const result = await api.requestPromise(
      `/organizations/${orgId}/incidents/${alertId}/comments/`,
      {
        method: 'POST',
        data: {
          mentions: note.mentions,
          comment: note.text,
        },
      }
    );

    return result;
  } catch (err) {
    addErrorMessage(t('Unable to post comment'));
    throw err;
  }
}

/**
 * Deletes a note for an incident
 */
export async function deleteIncidentNote(
  api: Client,
  orgId: string,
  alertId: string,
  noteId: string
) {
  try {
    const result = await api.requestPromise(
      `/organizations/${orgId}/incidents/${alertId}/comments/${noteId}/`,
      {
        method: 'DELETE',
      }
    );

    return result;
  } catch (err) {
    addErrorMessage(t('Failed to delete comment'));
    throw err;
  }
}

/**
 * Updates a note for an incident
 */
export async function updateIncidentNote(
  api: Client,
  orgId: string,
  alertId: string,
  noteId: string,
  note: NoteType
) {
  try {
    const result = await api.requestPromise(
      `/organizations/${orgId}/incidents/${alertId}/comments/${noteId}/`,
      {
        method: 'PUT',
        data: {
          mentions: note.mentions,
          comment: note.text,
        },
      }
    );
    clearIndicators();
    return result;
  } catch (err) {
    addErrorMessage(t('Unable to update comment'));
    throw err;
  }
}

// This doesn't return anything because you shouldn't need to do anything with
// the result success or fail
export async function markIncidentAsSeen(api: Client, orgId: string, incident) {
  if (!incident || incident.hasSeen) {
    return;
  }

  try {
    await api.requestPromise(
      `/organizations/${orgId}/incidents/${incident.identifier}/seen/`,
      {
        method: 'POST',
        data: {
          hasSeen: true,
        },
      }
    );
  } catch (err) {
    // do nothing
  }
}
