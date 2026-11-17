import {useRef} from 'react';
import {useMutation} from '@tanstack/react-query';

import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getHandoffPrompt} from './handoffPrompt';

function formatPrompt(code: string) {
  return getHandoffPrompt(code, handoffCode => `\`${handoffCode}\``);
}

export enum AgentHandoffFlow {
  CREATE_PROJECT = 'create_project',
  ONBOARDING = 'onboarding',
}

interface Handoff {
  code: string;
  expiresAt: string;
  handoffId: string;
}

interface PreparedPrompt {
  handoffId: string;
  text: string;
}

interface ProjectSetupContext {
  runId: string;
}

interface HandoffContexts {
  [AgentHandoffFlow.CREATE_PROJECT]: ProjectSetupContext;
  [AgentHandoffFlow.ONBOARDING]: ProjectSetupContext;
}

export type AgentHandoffContext<Flow extends AgentHandoffFlow = AgentHandoffFlow> =
  HandoffContexts[Flow];

interface HandoffPromptOptions<Flow extends AgentHandoffFlow> {
  context: AgentHandoffContext<Flow>;
  disableIpPinning: boolean;
}

interface PromptContext<
  Flow extends AgentHandoffFlow,
> extends HandoffPromptOptions<Flow> {
  flow: Flow;
  organizationSlug: string;
}

interface CachedHandoff<Flow extends AgentHandoffFlow>
  extends PromptContext<Flow>, Handoff {}

interface CopyPromptOptions {
  disableIpPinning: boolean;
}

const PROMPT_EXPIRATION_BUFFER_MS = 60_000;

function isHandoffStale<Flow extends AgentHandoffFlow>(
  handoff: CachedHandoff<Flow>,
  context: PromptContext<Flow>
) {
  return (
    handoff.organizationSlug !== context.organizationSlug ||
    handoff.flow !== context.flow ||
    handoff.context.runId !== context.context.runId ||
    handoff.disableIpPinning !== context.disableIpPinning ||
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
 * the code in the UI. Valid codes are cached until their context changes or they approach
 * expiration, and concurrent copy requests share the same operation. Call copyPrompt
 * directly from the user gesture that authorizes clipboard access.
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

  async function getPrompt(options: HandoffPromptOptions<Flow>): Promise<PreparedPrompt> {
    const promptContext: PromptContext<Flow> = {
      ...options,
      flow,
      organizationSlug: organization.slug,
    };

    const cachedHandoff = handoff.current;
    if (cachedHandoff && !isHandoffStale(cachedHandoff, promptContext)) {
      return {handoffId: cachedHandoff.handoffId, text: formatPrompt(cachedHandoff.code)};
    }

    try {
      const minted = await fetchMutation<Handoff>({
        method: 'POST',
        url: getApiUrl('/organizations/$organizationIdOrSlug/agent-handoff/prompts/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        data: {
          flow,
          context: options.context,
          disableIpPinning: options.disableIpPinning,
        },
      });
      handoff.current = {...minted, ...promptContext};

      return {handoffId: minted.handoffId, text: formatPrompt(minted.code)};
    } catch {
      throw new Error(t('Unable to create your agent prompt. Try again.'));
    }
  }

  function beginCopy(options: CopyPromptOptions) {
    if (!context) {
      return Promise.reject(new Error(t('Your agent prompt is still being prepared.')));
    }

    const preparedPrompt = getPrompt({...options, context});
    const clipboardPayload = preparedPrompt.then(
      ({text}) => new Blob([text], {type: 'text/plain'})
    );
    let clipboardWrite: Promise<void>;
    try {
      clipboardWrite = navigator.clipboard
        .write([
          new ClipboardItem({
            'text/plain': clipboardPayload,
          }),
        ])
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

        return promptResult.value.handoffId;
      }
    );
  }

  function copyPrompt(options: CopyPromptOptions) {
    if (copyOperation.current) {
      return copyOperation.current;
    }

    const operation = mutation.mutateAsync(beginCopy(options));
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
    reset: mutation.reset,
  };
}
