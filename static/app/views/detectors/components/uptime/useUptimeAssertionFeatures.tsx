import {areAiFeaturesAllowed} from 'sentry/utils/seer/areAiFeaturesAllowed';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useUptimeAssertionFeatures() {
  const organization = useOrganization();

  const hasAiAssertionSuggestions =
    organization.features.includes('uptime-ai-assertion-suggestions') &&
    areAiFeaturesAllowed(organization);

  return {hasRuntimeAssertions: true, hasAiAssertionSuggestions};
}
