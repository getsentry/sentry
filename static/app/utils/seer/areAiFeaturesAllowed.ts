import {ConfigStore} from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';

export function areAiFeaturesAllowed(
  organization: Pick<Organization, 'features' | 'hideAiFeatures'>
): boolean {
  return (
    !ConfigStore.get('isSelfHosted') &&
    !organization.hideAiFeatures &&
    organization.features.includes('gen-ai-features')
  );
}
