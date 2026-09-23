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
      content: getInstallContent(t('Add the Sentry Deno SDK as a dependency:')),
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
          code: `import { McpServer } from "npm:@modelcontextprotocol/sdk";

const server = Sentry.wrapMcpServerWithSentry(new McpServer({
  name: "my-mcp-server",
  version: "1.0.0",
}));`,
        },
      ],
    },
    // Not collapsible: the MCP onboarding's GuidedSteps drops collapsible steps.
    getDataCollectionStep({
      collapsible: false,
      docsLink:
        'https://docs.sentry.io/platforms/javascript/guides/deno/configuration/options/#dataCollection',
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
            'Register a tool on the wrapped server and call it. The tool call creates a span, which you can find in Sentry.'
          ),
        },
        {
          type: 'code',
          language: 'typescript',
          code: `import { z } from "npm:zod";

server.tool(
  "roll_dice",
  { sides: z.number() },
  ({ sides }) => ({
    content: [{ type: "text", text: String(1 + Math.floor(Math.random() * sides)) }],
  }),
);`,
        },
      ],
    },
  ],
};
