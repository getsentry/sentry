import {useState} from 'react';

import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';

import {AgentHandoffFlow, type AgentHandoffContext} from './types';
import {useAgentHandoff} from './useAgentHandoff';

interface UseHandoffPromptCopyOptions<Flow extends AgentHandoffFlow> {
  context: AgentHandoffContext<Flow> | null;
  flow: Flow;
  onCopySuccess?: (handoffId: string) => void;
}

export function useHandoffPromptCopy<Flow extends AgentHandoffFlow>({
  flow,
  context,
  onCopySuccess,
}: UseHandoffPromptCopyOptions<Flow>) {
  const [useIpPinning, setUseIpPinning] = useState(true);
  const handoff = useAgentHandoff(flow, context);
  // Minting the code is near-instant, so a busy or disabled state while it runs
  // only flashes. copyPrompt ignores clicks until the request settles.
  const copyDisabled = !context;

  function copyPrompt() {
    if (handoff.isPending) {
      return;
    }
    void handoff
      .copyPrompt({disableIpPinning: !useIpPinning})
      .then(handoffId => {
        toast.success(t('Agent prompt copied to clipboard'));
        onCopySuccess?.(handoffId);
      })
      .catch(() => null);
  }

  function toggleIpPinning() {
    setUseIpPinning(enabled => !enabled);
    handoff.reset();
  }

  return {copyPrompt, copyDisabled, handoff, useIpPinning, toggleIpPinning};
}
