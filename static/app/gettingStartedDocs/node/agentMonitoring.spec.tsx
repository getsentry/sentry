import type {
  DocsParams,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {agentMonitoring} from 'sentry/gettingStartedDocs/node/agentMonitoring';

function makeParams(platformOptions: Record<string, string> = {}): DocsParams {
  return {
    dsn: {public: 'https://public@o1.ingest.sentry.io/1'},
    platformOptions,
    project: {id: '1', slug: 'project-slug', platform: 'node'},
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

describe('node agentMonitoring onboarding', () => {
  const config = agentMonitoring();

  describe('Node deployment target', () => {
    it('initializes the SDK with Sentry.init', () => {
      const code = collectCode(
        config.configure(makeParams({integration: 'openai', deploymentTarget: 'node'}))
      );

      expect(code).toContain('Sentry.init({');
      expect(code).toContain('@sentry/node');
      expect(code).not.toContain('Sentry.withSentry');
    });

    it('defaults to the Node target when no deployment target is selected', () => {
      const code = collectCode(config.configure(makeParams({integration: 'openai'})));

      expect(code).toContain('Sentry.init({');
      expect(code).not.toContain('Sentry.withSentry');
    });

    it('installs @sentry/node', () => {
      const code = collectCode(config.install(makeParams({integration: 'openai'})));

      expect(code).toContain('npm install @sentry/node');
      expect(code).not.toContain('@sentry/cloudflare');
    });

    it('uses Sentry.init for manual instrumentation', () => {
      const code = collectCode(config.configure(makeParams({integration: 'manual'})));

      expect(code).toContain('Sentry.init({');
      expect(code).not.toContain('Sentry.withSentry');
    });

    it('shows a raw-SDK verify snippet (auto-instrumented on Node)', () => {
      const code = collectCode(config.verify(makeParams({integration: 'openai'})));

      expect(code).toContain('responses.create');
    });
  });

  describe('Cloudflare deployment target', () => {
    it('bootstraps the SDK with Sentry.withSentry instead of Sentry.init', () => {
      const code = collectCode(
        config.configure(
          makeParams({integration: 'anthropic', deploymentTarget: 'cloudflare'})
        )
      );

      expect(code).toContain('Sentry.withSentry(');
      expect(code).toContain('import * as Sentry from "@sentry/cloudflare"');
      expect(code).not.toContain('Sentry.init(');
      expect(code).not.toContain('nodejs_compat');
      expect(code).not.toContain('vercelAIIntegration');
    });

    it('wraps the client explicitly for non-Vercel integrations (not auto-instrumented on Cloudflare)', () => {
      const code = collectCode(
        config.configure(
          makeParams({integration: 'openai', deploymentTarget: 'cloudflare'})
        )
      );

      // Worker is wrapped, and the client must be instrumented explicitly
      expect(code).toContain('Sentry.withSentry(');
      expect(code).toContain('Sentry.instrumentOpenAiClient(');
      // These integrations don't use the nodejs_compat entrypoint (that's Vercel AI)
      expect(code).not.toContain('nodejs_compat');
    });

    it('does not show a raw-SDK verify snippet for wrapped Cloudflare integrations', () => {
      const code = collectCode(
        config.verify(makeParams({integration: 'openai', deploymentTarget: 'cloudflare'}))
      );

      // The wrapped-client call is shown in the Configure step instead
      expect(code).toBe('');
    });

    it('treats Workers AI as auto-instrumented (no client wrapping)', () => {
      const configureCode = collectCode(
        config.configure(
          makeParams({integration: 'workers_ai', deploymentTarget: 'cloudflare'})
        )
      );

      expect(configureCode).toContain('Sentry.withSentry(');
      expect(configureCode).toContain('import * as Sentry from "@sentry/cloudflare"');
      expect(configureCode).not.toContain('instrument');
      expect(configureCode).not.toContain('nodejs_compat');
      expect(configureCode).not.toContain('vercelAIIntegration');
    });

    it('verifies Workers AI via the env.AI binding', () => {
      const verifyCode = collectCode(
        config.verify(
          makeParams({integration: 'workers_ai', deploymentTarget: 'cloudflare'})
        )
      );

      expect(verifyCode).toContain('env.AI.run(');
    });

    it('uses the nodejs_compat entrypoint and registers the Vercel AI integration', () => {
      const code = collectCode(
        config.configure(
          makeParams({integration: 'vercel_ai', deploymentTarget: 'cloudflare'})
        )
      );

      expect(code).toContain('Sentry.withSentry(');
      expect(code).toContain(
        'import * as Sentry from "@sentry/cloudflare/nodejs_compat"'
      );
      expect(code).toContain('integrations: [Sentry.vercelAIIntegration()]');
    });

    it('installs @sentry/cloudflare', () => {
      const code = collectCode(
        config.install(
          makeParams({integration: 'openai', deploymentTarget: 'cloudflare'})
        )
      );

      expect(code).toContain('npm install @sentry/cloudflare');
      expect(code).not.toContain('@sentry/node');
    });

    it('uses Sentry.withSentry for manual instrumentation', () => {
      const code = collectCode(
        config.configure(
          makeParams({integration: 'manual', deploymentTarget: 'cloudflare'})
        )
      );

      expect(code).toContain('Sentry.withSentry(');
      expect(code).not.toContain('Sentry.init(');
    });
  });
});
