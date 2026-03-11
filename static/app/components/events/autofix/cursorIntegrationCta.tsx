import {makeCodingAgentIntegrationCta} from 'sentry/components/events/autofix/codingAgentIntegrationCta';
import {CodingAgentProvider} from 'sentry/components/events/autofix/types';

export const CursorIntegrationCta = makeCodingAgentIntegrationCta({
  provider: 'cursor',
  featureFlag: 'integrations-cursor',
  target: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
  pluginId: 'cursor',
  displayName: 'Cursor',
  headingName: 'Cursor Agent',
  docsUrl: 'https://docs.sentry.io/organization/integrations/cursor/',
});
