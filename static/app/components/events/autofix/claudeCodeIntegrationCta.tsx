import {makeCodingAgentIntegrationCta} from 'sentry/components/events/autofix/codingAgentIntegrationCta';
import {CodingAgentProvider} from 'sentry/components/events/autofix/types';

export const ClaudeCodeIntegrationCta = makeCodingAgentIntegrationCta({
  provider: 'claude_code',
  featureFlag: 'integrations-claude-code',
  target: CodingAgentProvider.CLAUDE_CODE_AGENT,
  pluginId: 'claude_code',
  displayName: 'Claude',
  headingName: 'Claude Agent',
  docsUrl: 'https://docs.sentry.io/organization/integrations/claude-code/',
});
