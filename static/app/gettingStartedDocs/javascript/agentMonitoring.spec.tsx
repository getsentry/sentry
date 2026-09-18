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
