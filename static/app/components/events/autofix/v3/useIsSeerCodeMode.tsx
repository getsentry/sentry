import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * In code mode Seer Agent drives the Autofix run itself. Surfaces that talk to
 * the Autofix endpoints directly, or that narrate a run the agent now owns,
 * have to defer to it.
 *
 * This lives apart from `useAskSeerHandoff` so that reading the mode does not
 * pull the Seer Explorer drawer into components that only need the answer.
 */
export function useIsSeerCodeMode() {
  const organization = useOrganization();
  return organization.features.includes('seer-explorer-code-mode-tools');
}
