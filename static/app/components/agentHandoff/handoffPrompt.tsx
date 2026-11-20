import type {ReactNode} from 'react';

import {reactNodeToText} from 'sentry/components/onboarding/utils/stepsToMarkdown';
import {tct} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';

import {AgentHandoffFlow, type AgentHandoffContext} from './types';

interface HandoffPromptParts {
  code: ReactNode;
  url: ReactNode;
}

export function getHandoffGuideUrl(): string {
  return `${ConfigStore.get('urlPrefix').replace(/\/$/, '')}/agent-handoff.md`;
}

/**
 * Builds the agent handoff prompt. The parts decide how the guide URL and the handoff
 * code appear, such as a link and a masked code in the preview, or plain text in the
 * copied prompt, so both share one template and their wording can't drift apart.
 */
export function getHandoffPrompt(
  flow: AgentHandoffFlow,
  context: AgentHandoffContext | null,
  {url, code}: HandoffPromptParts
): ReactNode {
  if (flow === AgentHandoffFlow.ADD_FEATURE && context && 'product' in context) {
    return tct(
      'Read and follow [url] verbatim to set up [product]. Your handoff code is [code].',
      {url, code, product: context.product}
    );
  }
  return tct('Read and follow [url] verbatim. Your handoff code is [code].', {url, code});
}

/**
 * The prompt text that is copied for the agent.
 */
export function formatHandoffPrompt(
  code: string,
  flow: AgentHandoffFlow,
  context: AgentHandoffContext | null
): string {
  return reactNodeToText(
    getHandoffPrompt(flow, context, {url: getHandoffGuideUrl(), code: `\`${code}\``})
  );
}
