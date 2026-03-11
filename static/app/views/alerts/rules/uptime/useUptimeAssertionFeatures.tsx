import useOrganization from 'sentry/utils/useOrganization';

export function useUptimeAssertionFeatures() {
  const organization = useOrganization();

  const hasRuntimeAssertions = organization.features.includes(
    'uptime-runtime-assertions'
  );
  const hasAiAssertionSuggestions =
    hasRuntimeAssertions &&
    organization.features.includes('uptime-ai-assertion-suggestions') &&
    organization.features.includes('gen-ai-features') &&
    !organization.hideAiFeatures;

  return {hasRuntimeAssertions, hasAiAssertionSuggestions};
}
