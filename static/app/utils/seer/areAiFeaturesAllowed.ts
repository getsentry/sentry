import {ConfigStore} from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';

export function areAiFeaturesAllowed(
  organization: Pick<Organization, 'hideAiFeatures'>
): boolean {
  return !ConfigStore.get('isSelfHosted') && !organization.hideAiFeatures;
}
