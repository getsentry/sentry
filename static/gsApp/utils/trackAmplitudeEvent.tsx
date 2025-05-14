import * as Amplitude from '@amplitude/analytics-browser';

import ConfigStore from 'sentry/stores/configStore';

// keep track of the last org id so we can update the group if it changes
let lastOrganizationId: number | null = null;

function trackAmplitudeEvent(
  event_type: string,
  organization_id: number | null | undefined,
  data: Record<PropertyKey, unknown>,
  eventOptions?: {time?: number}
) {
  // quit early if analytics is disabled
  if (!ConfigStore.get('enableAnalytics')) {
    return;
  }
  const user = ConfigStore.get('user');
  Amplitude.setUserId(user?.id ?? null);

  // Most of the time an event will be in the context of an org, and if so, we must attach
  // the org to the event to make amplitude's org-reporting work. To reduce the possibility
  // of error we require the caller to be explicit about the org. To intentionally not record
  // an org, organization_id can be set to null.
  if (organization_id === undefined) {
    return;
  }

  // if the org id has changed, we need to update the group
  if (organization_id !== lastOrganizationId) {
    Amplitude.setGroup('organization_id', organization_id?.toString() || '');
    lastOrganizationId = organization_id;
  }
  Amplitude.track(event_type, data, eventOptions);
}

export default trackAmplitudeEvent;
