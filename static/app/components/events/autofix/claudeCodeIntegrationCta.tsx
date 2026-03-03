import {makeCodingAgentIntegrationCta} from 'sentry/components/events/autofix/codingAgentIntegrationCta';

export const ClaudeCodeIntegrationCta = makeCodingAgentIntegrationCta({
  provider: 'claude_code',
  featureFlag: 'integrations-claude-code',
  target: 'claude_code_agent',
  pluginId: 'claude_code',
  displayName: 'Claude',
  headingName: 'Claude Agent',
  docsUrl: 'https://docs.sentry.io/organization/integrations/claude-code/',
});
