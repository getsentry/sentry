import {Fragment, type ReactNode} from 'react';

import {ConfigStore} from 'sentry/stores/configStore';

import {AgentHandoffFlow, type AgentHandoffContext} from './types';

type WrapCode<T> = (code: string) => T;

function getInstruction(
  flow: AgentHandoffFlow,
  context: AgentHandoffContext | null,
  guideUrl: string
): string {
  switch (flow) {
    case AgentHandoffFlow.ADD_FEATURE:
      if (context && 'product' in context) {
        return `Read and follow ${guideUrl} verbatim to set up ${context.product}.`;
      }
      break;
    default:
      break;
  }
  return `Read and follow ${guideUrl} verbatim.`;
}

/**
 * Builds the agent handoff prompt around its handoff code. `wrapCode` decides how the
 * code appears, such as in backticks for the copied text or masked for the preview, so
 * both share one template and their wording can't drift apart. A wrapper that returns a
 * string produces a plain string prompt. The prompt is read by the agent, so it is
 * intentionally not translated.
 *
 * The flow determines whether and how the prompt names the product.
 */
export function getHandoffPrompt(
  code: string,
  flow: AgentHandoffFlow,
  context: AgentHandoffContext | null,
  wrapCode: WrapCode<string>
): string;
export function getHandoffPrompt(
  code: string,
  flow: AgentHandoffFlow,
  context: AgentHandoffContext | null,
  wrapCode: WrapCode<ReactNode>
): ReactNode;
export function getHandoffPrompt(
  code: string,
  flow: AgentHandoffFlow,
  context: AgentHandoffContext | null,
  wrapCode: WrapCode<ReactNode>
): ReactNode {
  const guideUrl = `${ConfigStore.get('urlPrefix').replace(/\/$/, '')}/agent-handoff.md`;
  const instruction = getInstruction(flow, context, guideUrl);
  const start = `${instruction} Your handoff code is `;
  const end = '.';
  const wrappedCode = wrapCode(code);

  if (typeof wrappedCode === 'string') {
    return `${start}${wrappedCode}${end}`;
  }

  return (
    <Fragment>
      {start}
      {wrappedCode}
      {end}
    </Fragment>
  );
}
