import {useEffect, useRef} from 'react';
import {useMutation} from '@tanstack/react-query';
import isEqual from 'lodash/isEqual';

import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

import {formatHandoffPrompt} from './handoffPrompt';
import {AgentHandoffFlow, type AgentHandoffContext} from './types';

interface Handoff {
  code: string;
  expiresAt: string;
  handoffId: string;
}

interface PreparedPrompt {
  handoffId: string;
  text: string;
}

interface PromptContext<Flow extends AgentHandoffFlow> {
  context: AgentHandoffContext<Flow>;
  flow: Flow;
  organizationSlug: string;
}

interface CachedHandoff<Flow extends AgentHandoffFlow>
  extends PromptContext<Flow>, Handoff {
  copied?: boolean;
}

const PROMPT_EXPIRATION_BUFFER_MS = 60_000;

function isHandoffStale<Flow extends AgentHandoffFlow>(
  handoff: CachedHandoff<Flow>,
  context: PromptContext<Flow>
) {
  return (
    handoff.organizationSlug !== context.organizationSlug ||
    handoff.flow !== context.flow ||
    !isEqual(handoff.context, context.context) ||
    Date.parse(handoff.expiresAt) <= Date.now() + PROMPT_EXPIRATION_BUFFER_MS
  );
}

function clipboardError() {
  return new Error(
    t('Unable to copy your agent prompt. Allow clipboard access and try again.')
  );
}

/**
 * Mints short-lived handoff codes and copies a prompt containing them without exposing
 * the code in the UI. Concurrent copy requests share the same operation. Call copyPrompt
 * directly from the user gesture that authorizes clipboard access.
 *
 * Codes are single-use. Once a copied code could have been pasted into an agent, which
 * means the page was hidden after the copy, the next copy mints a fresh code. Repeated
 * copies while the page stays visible reuse the code, so mashing the button does not
 * mint a pile of unused codes.
 */
export function useAgentHandoff<Flow extends AgentHandoffFlow>(
  flow: Flow,
  context: AgentHandoffContext<Flow> | null
) {
  const organization = useOrganization();
  const handoff = useRef<CachedHandoff<Flow> | null>(null);
  const copyOperation = useRef<Promise<string> | null>(null);
  const mutation = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (operation: Promise<string>) => operation,
  });

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && handoff.current?.copied) {
        handoff.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  async function getPrompt(
    promptTarget: AgentHandoffContext<Flow>
  ): Promise<PreparedPrompt> {
    const promptContext: PromptContext<Flow> = {
      context: promptTarget,
      flow,
      organizationSlug: organization.slug,
    };

    const cachedHandoff = handoff.current;
    if (cachedHandoff && !isHandoffStale(cachedHandoff, promptContext)) {
      return {
        handoffId: cachedHandoff.handoffId,
        text: formatHandoffPrompt(cachedHandoff.code, flow, promptTarget),
      };
    }

    try {
      const minted = await fetchMutation<Handoff>({
        method: 'POST',
        url: getApiUrl('/organizations/$organizationIdOrSlug/agent-handoff/prompts/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        data: {flow, context: promptTarget},
      });
      handoff.current = {...minted, ...promptContext};

      return {
        handoffId: minted.handoffId,
        text: formatHandoffPrompt(minted.code, flow, promptTarget),
      };
    } catch {
      throw new Error(t('Unable to create your agent prompt. Try again.'));
    }
  }

  function beginCopy() {
    if (!context) {
      return Promise.reject(new Error(t('Your agent prompt is still being prepared.')));
    }

    const preparedPrompt = getPrompt(context);
    const clipboardPayload = preparedPrompt.then(
      ({text}) => new Blob([text], {type: 'text/plain'})
    );
    let clipboardWrite: Promise<void>;
    try {
      clipboardWrite = navigator.clipboard
        .write([new ClipboardItem({'text/plain': clipboardPayload})])
        .catch(() => {
          throw clipboardError();
        });
    } catch {
      clipboardWrite = Promise.reject(clipboardError());
    }

    return Promise.allSettled([preparedPrompt, clipboardPayload, clipboardWrite]).then(
      ([promptResult, , clipboardResult]) => {
        if (promptResult.status === 'rejected') {
          throw promptResult.reason;
        }

        if (clipboardResult.status === 'rejected') {
          throw clipboardResult.reason;
        }

        const cachedHandoff = handoff.current;
        if (cachedHandoff?.handoffId === promptResult.value.handoffId) {
          // The page can be hidden before the clipboard write settles, and then no
          // visibilitychange will follow to retire the code.
          handoff.current = document.hidden ? null : {...cachedHandoff, copied: true};
        }
        return promptResult.value.handoffId;
      }
    );
  }

  function copyPrompt() {
    if (copyOperation.current) {
      return copyOperation.current;
    }

    const operation = mutation.mutateAsync(beginCopy());
    copyOperation.current = operation;

    const clearOperation = () => {
      if (copyOperation.current === operation) {
        copyOperation.current = null;
      }
    };
    operation.then(clearOperation, clearOperation);

    return operation;
  }

  return {
    copyPrompt,
    error: mutation.error,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
  };
}
