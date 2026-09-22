import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  GEN_AI_DATA_COLLECTION_SNIPPET,
  getDataCollectionStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';

import {getInstallContent, sentryImport} from './utils';

export const mcp: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: getInstallContent(
        tct(
          'To enable MCP monitoring, you need to install the Sentry SDK with a minimum version of [code:9.44.0].',
          {code: <code />}
        )
      ),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct('Initialize the Sentry SDK by calling [code:Sentry.init()]:', {
            code: <code />,
          }),
        },
        {
          type: 'code',
          language: 'typescript',
          code: `${sentryImport}

Sentry.init({
  dsn: "${params.dsn.public}",
  // Tracing must be enabled for MCP monitoring to work
  tracesSampleRate: 1.0,
});`,
        },
        {
          type: 'text',
          text: tct(
            'Wrap your MCP server in a [code:Sentry.wrapMcpServerWithSentry()] call. This will automatically capture spans for all MCP server interactions.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'typescript',
          code: `import { McpServer } from "@modelcontextprotocol/sdk";

const server = Sentry.wrapMcpServerWithSentry(new McpServer({
  name: "my-mcp-server",
  version: "1.0.0",
}));`,
        },
      ],
    },
    // Not collapsible: the MCP onboarding renders `GuidedSteps`, which drops
    // every collapsible step.
    getDataCollectionStep({
      collapsible: false,
      docsLink:
        'https://docs.sentry.io/platforms/javascript/guides/bun/configuration/options/#dataCollection',
      description: t(
        'By default, the SDK sends the inputs and outputs of your MCP tool calls, prompt retrievals, and resource reads. This gives you rich debugging context.'
      ),
      code: GEN_AI_DATA_COLLECTION_SNIPPET,
    }),
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that MCP monitoring is working correctly by triggering some MCP server interactions in your application.'
          ),
        },
      ],
    },
  ],
};
