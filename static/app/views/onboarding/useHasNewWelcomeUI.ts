import useOrganization from 'sentry/utils/useOrganization';

export function useHasNewWelcomeUI() {
  const organization = useOrganization();
  const hasNewWelcomeUI = organization.features.includes('onboarding-new-welcome-ui');

  return hasNewWelcomeUI;
}
