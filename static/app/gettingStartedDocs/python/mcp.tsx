import {ExternalLink} from '@sentry/scraps/link';

import type {
  OnboardingConfig,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {getPythonInstallCodeBlock} from './utils';

export const mcp: OnboardingConfig = {
  install: params => {
    const packageName = 'sentry-sdk';

    return [
      {
        type: StepType.INSTALL,
        content: [
          {
            type: 'text',
            text:
              params.platformOptions?.integration === 'mcp_sdk'
                ? tct(
                    'To enable MCP monitoring for the [code:fastmcp] and [code:mcp] packages, you need to install the Sentry SDK with a minimum version of [code:2.43.0] or higher.',
                    {
                      code: <code />,
                    }
                  )
                : tct(
                    'To enable MCP monitoring, you need to install the Sentry SDK with a minimum version of [code:2.43.0] or higher.',
                    {
                      code: <code />,
                    }
                  ),
          },
          getPythonInstallCodeBlock({packageName}),
        ],
      },
    ];
  },
  configure: params => {
    const mcpSdkStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Add the [code:MCPIntegration] to your [code:sentry_sdk.init] call:',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import sentry_sdk
from sentry_sdk.integrations.mcp import MCPIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
    traces_sample_rate=1.0,
    # Add data like inputs and responses to/from MCP servers;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[
        MCPIntegration(),
    ],
)`,
        },
      ],
    };

    const manualStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t('Initialize the Sentry SDK in the entry point of your application:'),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn.public}",
    traces_sample_rate=1.0,
)
`,
        },
        {
          type: 'text',
          text: tct(
            'Then follow the [link:manual instrumentation guide] to instrument your MCP server.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/tracing/instrumentation/custom-instrumentation/mcp-module/#manual-instrumentation" />
              ),
            }
          ),
        },
      ],
    };

    const selected = (params.platformOptions as any)?.integration ?? 'mcp_sdk';
    if (selected === 'mcp_sdk') {
      return [mcpSdkStep];
    }
    if (selected === 'manual') {
      return [manualStep];
    }
    return [mcpSdkStep];
  },
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
  nextSteps: () => [],
};
