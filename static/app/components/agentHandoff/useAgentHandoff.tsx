import {useRef} from 'react';
import {useMutation} from '@tanstack/react-query';

import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';

export enum AgentHandoffFlow {
  ONBOARDING = 'onboarding',
}

type HandoffPrompt = {
  expiresAt: string;
  prompt: string;
};

type CopyOptions = {
  disableIpPinning: boolean;
};

function clipboardError() {
  return new Error(
    t('Unable to copy your agent prompt. Allow clipboard access and try again.')
  );
}

export function useAgentHandoff(flow: AgentHandoffFlow) {
  const organization = useOrganization();
  const prompt = useRef<(HandoffPrompt & {disableIpPinning: boolean}) | null>(null);
  const {copy} = useCopyToClipboard();

  const mutation = useMutation<void, Error, Promise<void>>({
    gcTime: 0,
    retry: false,
    mutationFn: operation => operation,
  });

  async function getPrompt({disableIpPinning}: CopyOptions) {
    if (
      !prompt.current ||
      prompt.current.disableIpPinning !== disableIpPinning ||
      Date.parse(prompt.current.expiresAt) <= Date.now()
    ) {
      try {
        const minted = await fetchMutation<HandoffPrompt>({
          method: 'POST',
          url: getApiUrl('/organizations/$organizationIdOrSlug/agent-handoff/prompts/', {
            path: {organizationIdOrSlug: organization.slug},
          }),
          data: {flow, disableIpPinning},
        });
        prompt.current = {...minted, disableIpPinning};
      } catch {
        throw new Error(t('Unable to create your agent prompt. Please try again.'));
      }
    }

    return prompt.current.prompt;
  }

  function beginCopy(options: CopyOptions) {
    const promptText = getPrompt(options);

    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
      const clipboardWrite = navigator.clipboard
        .write([
          new ClipboardItem({
            'text/plain': promptText.then(text => new Blob([text], {type: 'text/plain'})),
          }),
        ])
        .then(
          () => null,
          () => clipboardError()
        );

      return promptText.then(async () => {
        const error = await clipboardWrite;
        if (error) {
          throw error;
        }
      });
    }

    return promptText.then(async text => {
      const copied = await copy(text, null);
      if (!copied) {
        throw clipboardError();
      }
    });
  }

  function mutate(options: CopyOptions, callbacks?: {onSuccess?: () => void}) {
    mutation.mutate(beginCopy(options), {onSuccess: callbacks?.onSuccess});
  }

  function mutateAsync(options: CopyOptions) {
    return mutation.mutateAsync(beginCopy(options));
  }

  return {...mutation, mutate, mutateAsync};
}
