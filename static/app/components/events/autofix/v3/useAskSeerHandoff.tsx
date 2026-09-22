import {useCallback} from 'react';

import {useIsSeerCodeMode} from 'sentry/components/events/autofix/v3/useIsSeerCodeMode';
import {useSeerExplorerDrawer} from 'sentry/views/seerExplorer/components/drawer/useSeerExplorerDrawer';

/**
 * With code mode on, Seer Agent can drive the run itself, so the next-step
 * answers stop calling the Autofix endpoints and hand the question to the agent
 * instead. The prompt is submitted for the reader, since the point of the
 * buttons is that they do not have to phrase it.
 *
 * `appendToOpenRun` keeps an agent session the reader already has going: the
 * question is about the analysis on screen, so starting a fresh session would
 * throw away the context that makes it answerable.
 */
export function useAskSeerHandoff() {
  const {openSeerExplorerDrawer} = useSeerExplorerDrawer();

  const isCodeMode = useIsSeerCodeMode();

  const askSeer = useCallback(
    (prompt: string) => {
      openSeerExplorerDrawer({initialQuery: prompt, appendToOpenRun: true});
    },
    [openSeerExplorerDrawer]
  );

  return {askSeer, isCodeMode};
}

/** Every step's "yes" asks for the same thing: get on with the run. */
export const ASK_SEER_CONTINUE_PROMPT = 'Run the next Autofix step';
