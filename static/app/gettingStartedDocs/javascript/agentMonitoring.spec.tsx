import {Fragment} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {
  DocsParams,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {reactNodeToText} from 'sentry/components/onboarding/utils/stepsToMarkdown';
import {agentMonitoring} from 'sentry/gettingStartedDocs/javascript/agentMonitoring';

function makeParams(platformOptions: Record<string, string> = {}): DocsParams {
  return {
    dsn: {public: 'https://public@o1.ingest.sentry.io/1'},
    platformOptions,
    // A meta-framework platform: these render via the JS agent monitoring config
    // but still surface the full Node integration list, including Cloudflare-only
    // SDKs.
    platformKey: 'javascript-nextjs',
    project: {id: '1', slug: 'project-slug', platform: 'javascript-nextjs'},
    isProfilingSelected: false,
    isLogsSelected: false,
    isFeedbackSelected: false,
    isMetricsSelected: false,
    isPerformanceSelected: true,
    isReplaySelected: false,
    sourcePackageRegistries: {isLoading: false, data: undefined},
  } as unknown as DocsParams;
}

function collectCode(steps: OnboardingStep[]): string {
  const codes: string[] = [];
  for (const step of steps) {
    for (const block of step.content ?? []) {
      if (block.type !== 'code') {
        continue;
      }
      if ('tabs' in block) {
        block.tabs.forEach(tab => codes.push(tab.code));
      } else {
        codes.push(block.code);
      }
    }
  }
  return codes.join('\n\n');
}

function collectText(steps: OnboardingStep[]): string {
  const parts: string[] = [];
  for (const step of steps) {
    for (const block of step.content ?? []) {
      if (block.type === 'text') {
        parts.push(reactNodeToText(block.text));
      }
    }
  }
  return parts.join(' ');
}

describe('javascript agentMonitoring onboarding', () => {
  const config = agentMonitoring();

  it.each(['openai', 'anthropic', 'google_genai', 'langchain', 'langgraph', 'manual'])(
    'uses manual browser instrumentation for %s',
    integration => {
      const params = makeParams({integration});
      params.platformKey = 'javascript';
      const steps = config.configure(params);
      const code = collectCode(steps);

      expect(code).toContain('import * as Sentry from "@sentry/browser"');
      expect(code).toContain('Sentry.init(');
      expect(code).toContain('tracesSampleRate: 1.0');
      expect(code).not.toMatch(
        /instrumentLangGraph|createLangChainCallbackHandler|instrumentGoogleGenAIClient|instrumentAnthropicAiClient|instrumentOpenAiClient/
      );

      const manualNote = steps
        .flatMap(step => step.content ?? [])
        .find(block => block.type === 'custom');
      render(<Fragment>{manualNote?.content}</Fragment>);
      expect(
        screen.getByRole('link', {name: 'manual instrumentation guide'})
      ).toHaveAttribute(
        'href',
        'https://docs.sentry.io/platforms/javascript/tracing/instrumentation/ai-agents-module-browser/#manual-span-creation'
      );
    }
  );

  it('uses the framework browser SDK and client configuration file for manual instrumentation', () => {
    const frameworkConfig = agentMonitoring({
      packageName: '@sentry/react',
      clientConfigFileName: 'sentry.client.config.ts',
    });
    const params = makeParams({integration: 'openai'});
    params.platformKey = 'javascript-react';
    const steps = frameworkConfig.configure(params);
    const code = collectCode(steps);

    expect(code).toContain('import * as Sentry from "@sentry/react"');
    expect(code).not.toContain('instrumentOpenAiClient');
    expect(steps[0]?.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'code',
          tabs: expect.arrayContaining([
            expect.objectContaining({label: 'sentry.client.config.ts'}),
          ]),
        }),
      ])
    );
  });

  it.each([
    ['openai', 'openai'],
    ['anthropic', '@anthropic-ai/sdk'],
    ['google_genai', '@google/genai'],
    ['langchain', '@langchain/openai'],
    ['langgraph', '@langchain/langgraph/prebuilt'],
  ] as const)(
    'keeps server configuration and verification for %s on Next.js',
    (integration, sdk) => {
      const frameworkConfig = agentMonitoring({
        packageName: '@sentry/nextjs',
        clientConfigFileName: 'instrumentation-client.ts',
        serverConfigFileName: 'sentry.server.config.ts',
      });
      const params = makeParams({integration});
      const steps = frameworkConfig.configure(params);

      expect(collectCode(steps)).toContain('@sentry/nextjs');
      expect(collectText(steps)).toContain('will be enabled automatically');
      expect(steps[0]?.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'code',
            tabs: expect.arrayContaining([
              expect.objectContaining({label: 'sentry.server.config.ts'}),
            ]),
          }),
        ])
      );
      expect(collectCode(frameworkConfig.verify(params))).toContain(sdk);
    }
  );

  // Workers AI and the Cloudflare Agents SDK only run on Cloudflare Workers, so
  // even on a meta-framework platform they must show the Node package's
  // Cloudflare setup rather than the browser Sentry.init flow.
  describe('Cloudflare-only SDKs reuse the Node Cloudflare setup', () => {
    it('wraps the Worker with Sentry.withSentry for Workers AI', () => {
      const code = collectCode(
        config.configure(
          makeParams({integration: 'workers_ai', deploymentTarget: 'cloudflare'})
        )
      );

      expect(code).toContain('Sentry.withSentry(');
      expect(code).toContain('import * as Sentry from "@sentry/cloudflare"');
      expect(code).not.toContain('Sentry.init(');
    });

    it('wraps the agent class with instrumentAgentWithSentry for the Agents SDK', () => {
      const code = collectCode(
        config.configure(
          makeParams({integration: 'cloudflare_agents', deploymentTarget: 'cloudflare'})
        )
      );

      expect(code).toContain('Sentry.instrumentAgentWithSentry(');
      expect(code).toContain('import * as Sentry from "@sentry/cloudflare"');
      expect(code).not.toContain('Sentry.init(');
    });

    it('installs @sentry/cloudflare at the Agents SDK minimum version', () => {
      const steps = config.install(
        makeParams({integration: 'cloudflare_agents', deploymentTarget: 'cloudflare'})
      );

      expect(collectCode(steps)).toContain('npm install @sentry/cloudflare');
      expect(collectText(steps)).toContain('10.69.0');
    });

    it('verifies the Agents SDK by triggering the agent, not a browser LLM call', () => {
      const steps = config.verify(
        makeParams({integration: 'cloudflare_agents', deploymentTarget: 'cloudflare'})
      );

      expect(collectText(steps)).toContain('Trigger your agent');
      expect(collectText(steps)).not.toContain('calling your LLM');
    });
  });
});
