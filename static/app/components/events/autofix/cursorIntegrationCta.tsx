import {makeCodingAgentIntegrationCta} from 'sentry/components/events/autofix/codingAgentIntegrationCta';

export const CursorIntegrationCta = makeCodingAgentIntegrationCta({
  provider: 'cursor',
  featureFlag: 'integrations-cursor',
  target: 'cursor_background_agent',
  pluginId: 'cursor',
  displayName: 'Cursor',
  headingName: 'Cursor Agent',
  docsUrl: 'https://docs.sentry.io/organization/integrations/cursor/',
});
