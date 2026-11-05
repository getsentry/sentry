import {makeCodingAgentIntegrationCta} from './codingAgentIntegrationCta';
import {CodingAgentProvider} from './types';

export const ClaudeCodeIntegrationCta = makeCodingAgentIntegrationCta({
  provider: 'claude_code',
  target: CodingAgentProvider.CLAUDE_CODE_AGENT,
  pluginId: 'claude_code',
  displayName: 'Claude',
  headingName: 'Claude Agent',
  docsUrl: 'https://docs.sentry.io/organization/integrations/coding-agents/claude/',
});
