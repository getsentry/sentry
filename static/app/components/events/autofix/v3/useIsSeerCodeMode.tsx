import {useOrganization} from 'sentry/utils/useOrganization';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

/**
 * In code mode Seer Agent drives the Autofix run itself. Surfaces that talk to
 * the Autofix endpoints directly, or that narrate a run the agent now owns,
 * have to defer to it.
 *
 * The agent is only reachable when the Explorer is, so both conditions are
 * checked together. Handing a run to a Seer the reader cannot open would strand
 * them with buttons that do nothing.
 *
 * This lives apart from `useAskSeerHandoff` so that reading the mode does not
 * pull the chat plumbing into components that only need the answer.
 */
export function useIsSeerCodeMode() {
  const organization = useOrganization();
  return (
    organization.features.includes('seer-explorer-code-mode-tools') &&
    isSeerExplorerEnabled(organization)
  );
}
