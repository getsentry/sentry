import {Fragment, type ReactNode} from 'react';

import {ConfigStore} from 'sentry/stores/configStore';

import {AgentHandoffFlow, type AgentHandoffContext} from './types';

type WrapCode<T> = (code: string) => T;
type WrapUrl = (url: string) => ReactNode;

function getInstructionEnd(
  flow: AgentHandoffFlow,
  context: AgentHandoffContext | null
): string {
  switch (flow) {
    case AgentHandoffFlow.ADD_FEATURE:
      if (context && 'product' in context) {
        return ` verbatim to set up ${context.product}.`;
      }
      break;
    default:
      break;
  }
  return ' verbatim.';
}

/**
 * Builds the agent handoff prompt around its handoff code. `wrapCode` decides how the
 * code appears, such as in backticks for the copied text or masked for the preview, so
 * both share one template and their wording can't drift apart. A wrapper that returns a
 * string produces a plain string prompt. `wrapUrl` can render the guide URL, such as a
 * link in the preview. The prompt is read by the agent, so it is intentionally not
 * translated.
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
  wrapCode: WrapCode<ReactNode>,
  wrapUrl?: WrapUrl
): ReactNode;
export function getHandoffPrompt(
  code: string,
  flow: AgentHandoffFlow,
  context: AgentHandoffContext | null,
  wrapCode: WrapCode<ReactNode>,
  wrapUrl?: WrapUrl
): ReactNode {
  const guideUrl = `${ConfigStore.get('urlPrefix').replace(/\/$/, '')}/agent-handoff.md`;
  const start = 'Read and follow ';
  const middle = `${getInstructionEnd(flow, context)} Your handoff code is `;
  const end = '.';
  const wrappedCode = wrapCode(code);

  if (typeof wrappedCode === 'string' && !wrapUrl) {
    return `${start}${guideUrl}${middle}${wrappedCode}${end}`;
  }

  return (
    <Fragment>
      {start}
      {wrapUrl ? wrapUrl(guideUrl) : guideUrl}
      {middle}
      {wrappedCode}
      {end}
    </Fragment>
  );
}
