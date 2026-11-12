import {ConfigStore} from 'sentry/stores/configStore';

function getHandoffGuideUrl() {
  return `${ConfigStore.get('urlPrefix').replace(/\/$/, '')}/agent-handoff/`;
}

/**
 * Splits the agent handoff prompt around its handoff code. The copied prompt and the
 * masked preview share this template so their wording can't drift apart. The prompt is
 * read by the agent, so it is intentionally not translated.
 */
export function buildHandoffPrompt<Code>(code: Code): [string, Code, string] {
  return [
    `Follow the instructions verbatim at ${getHandoffGuideUrl()}. Your handoff code is `,
    code,
    '.',
  ];
}

export function formatHandoffPrompt(code: string) {
  return buildHandoffPrompt(`\`${code}\``).join('');
}
