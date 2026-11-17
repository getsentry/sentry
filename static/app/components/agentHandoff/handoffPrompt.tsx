import {Fragment, type ReactNode} from 'react';

import {ConfigStore} from 'sentry/stores/configStore';
import {unreachable} from 'sentry/utils/unreachable';

import {AgentHandoffFlow, type AgentHandoffContext} from './useAgentHandoff';

type WrapCode<T> = (code: string) => T;

/**
 * Pairs each flow with the context it carries. Useful for functions that
 * need to discriminate on the flow and use the context together.
 */
export type HandoffPromptTarget<Flow extends AgentHandoffFlow = AgentHandoffFlow> = {
  [F in Flow]: {context: AgentHandoffContext<F> | null; flow: F};
}[Flow];

function getPromptPurpose(target: HandoffPromptTarget): string {
  switch (target.flow) {
    case AgentHandoffFlow.ADD_FEATURE:
      return target.context ? ` to set up ${target.context.product}` : '';
    case AgentHandoffFlow.CREATE_PROJECT:
    case AgentHandoffFlow.ONBOARDING:
      return '';
    default:
      return unreachable(target);
  }
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
  target: HandoffPromptTarget,
  wrapCode: WrapCode<string>
): string;
export function getHandoffPrompt(
  code: string,
  target: HandoffPromptTarget,
  wrapCode: WrapCode<ReactNode>
): ReactNode;
export function getHandoffPrompt(
  code: string,
  target: HandoffPromptTarget,
  wrapCode: WrapCode<ReactNode>
): ReactNode {
  const guideUrl = `${ConfigStore.get('urlPrefix').replace(/\/$/, '')}/agent-handoff.md`;
  const purpose = getPromptPurpose(target);
  const start = `Read and follow ${guideUrl} verbatim${purpose}. Your handoff code is `;
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
