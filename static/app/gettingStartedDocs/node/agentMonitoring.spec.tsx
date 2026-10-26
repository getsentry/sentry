import type {
  DocsParams,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {reactNodeToText} from 'sentry/components/onboarding/utils/stepsToMarkdown';
import {
  agentMonitoring,
  getMinRequiredVersion,
} from 'sentry/gettingStartedDocs/node/agentMonitoring';

function makeParams(platformOptions: Record<string, string> = {}): DocsParams {
  return {
    dsn: {
      public: 'https://public@o1.ingest.sentry.io/1',
      otlp_traces: 'https://o1.ingest.sentry.io/api/1/otlp/v1/traces',
    },
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

// Flattens the (possibly `tct`-produced) React nodes of every text block into a
// plain string so tests can assert on copy like the minimum SDK version.
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

describe('node agentMonitoring onboarding', () => {
  const config = agentMonitoring();

  it.each([
    ['11.0.0', 'eve'],
    ['11.0.0', 'mastra'],
    ['11.6.0', 'pi'],
    ['10.69.0', 'cloudflare_agents'],
    ['10.67.0', 'openai'],
  ])('requires SDK version %s for %s', (expectedVersion, integration) => {
    expect(getMinRequiredVersion(makeParams({integration}), '10.67.0')).toBe(
      expectedVersion
    );
  });

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
    it('bootstraps the SDK with the Cloudflare Vite plugin instead of Sentry.init', () => {
      const code = collectCode(
        config.configure(
          makeParams({integration: 'anthropic', deploymentTarget: 'cloudflare'})
        )
      );

      expect(code).toContain('sentryCloudflareVitePlugin()');
      expect(code).toContain('defineCloudflareOptions');
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

      // The plugin wraps the Worker, and the client must be instrumented explicitly
      expect(code).toContain('sentryCloudflareVitePlugin()');
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

      expect(configureCode).toContain('sentryCloudflareVitePlugin()');
      expect(configureCode).toContain('defineCloudflareOptions');
      expect(configureCode).not.toContain('instrumentOpenAiClient');
      expect(configureCode).not.toContain('instrumentAnthropicAiClient');
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

    it('uses build-time instrumentation for the Vercel AI integration', () => {
      const code = collectCode(
        config.configure(
          makeParams({integration: 'vercel_ai', deploymentTarget: 'cloudflare'})
        )
      );

      expect(code).toContain('sentryCloudflareVitePlugin()');
      expect(code).toContain('defineCloudflareOptions');
      expect(code).not.toContain('nodejs_compat');
      expect(code).not.toContain('vercelAIIntegration');
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

    it('uses the Cloudflare Vite plugin for manual instrumentation', () => {
      const code = collectCode(
        config.configure(
          makeParams({integration: 'manual', deploymentTarget: 'cloudflare'})
        )
      );

      expect(code).toContain('sentryCloudflareVitePlugin()');
      expect(code).toContain('defineCloudflareOptions');
      expect(code).not.toContain('Sentry.init(');
    });
  });

  describe('Flue', () => {
    it('installs via the blueprint on both runtimes', () => {
      const nodeCode = collectCode(config.install(makeParams({integration: 'flue'})));
      const cloudflareCode = collectCode(
        config.install(makeParams({integration: 'flue', deploymentTarget: 'cloudflare'}))
      );

      expect(nodeCode).toContain('flue add tooling sentry');
      expect(cloudflareCode).toContain('flue add tooling sentry');
      // The blueprint installs the SDK, so we don't show a raw npm install step.
      expect(nodeCode).not.toContain('npm install');
    });

    it('imports the generated sentry.ts on Node', () => {
      const code = collectCode(
        config.configure(makeParams({integration: 'flue', deploymentTarget: 'node'}))
      );

      expect(code).toContain('import "./sentry.ts"');
      expect(code).toContain('https://public@o1.ingest.sentry.io/1');
      expect(code).not.toContain('Sentry.withSentry(');
    });

    it('re-exports the cloudflare extension on Cloudflare', () => {
      const code = collectCode(
        config.configure(
          makeParams({integration: 'flue', deploymentTarget: 'cloudflare'})
        )
      );

      expect(code).toContain('export { cloudflare } from "../sentry.ts"');
      expect(code).toContain('wrangler secret put SENTRY_DSN');
      // Flue reads the DSN from bindings, so it is not inlined into the config.
      expect(code).not.toContain('Sentry.init(');
    });

    it('verifies through the agent rather than a raw SDK snippet', () => {
      const steps = config.verify(makeParams({integration: 'flue'}));

      // Flue auto-instruments, so verification is guidance only - no raw-SDK snippet.
      expect(steps).toHaveLength(1);
      expect(steps[0]!.type).toBe('verify');
      expect(collectCode(steps)).toBe('');
    });
  });

  describe('Mastra', () => {
    it('installs the Node SDK and Mastra observability package', () => {
      const code = collectCode(config.install(makeParams({integration: 'mastra'})));

      expect(code).toContain('npm install @sentry/node @mastra/observability');
      expect(code).not.toContain('@mastra/sentry');
    });

    it('preloads Sentry before Mastra starts', () => {
      const code = collectCode(config.configure(makeParams({integration: 'mastra'})));

      expect(code).toContain('Sentry.init({');
      expect(code).toContain('mastra dev --custom-args=');
      expect(code).toContain('--import=./instrument.mjs');
    });
  });

  describe('Eve', () => {
    it('installs the Node SDK', () => {
      const code = collectCode(config.install(makeParams({integration: 'eve'})));

      expect(code).toContain('npm install @sentry/node');
    });

    it('configures the Eve instrumentation provider with the project DSN', () => {
      const code = collectCode(config.configure(makeParams({integration: 'eve'})));

      expect(code).toContain('defineInstrumentation');
      expect(code).toContain('Sentry.eveInstrumentation({');
      expect(code).toContain('dsn: "https://public@o1.ingest.sentry.io/1"');
    });

    it('verifies by running the Eve agent', () => {
      const steps = config.verify(makeParams({integration: 'eve'}));
      const texts = steps
        .flatMap(step => step.content ?? [])
        .filter(block => block.type === 'text')
        .map(block => block.text);

      expect(
        texts.some(text => typeof text === 'string' && text.includes('Start Eve'))
      ).toBe(true);
    });
  });

  describe('Pi Durable', () => {
    it('installs the Node SDK', () => {
      const code = collectCode(config.install(makeParams({integration: 'pi'})));

      expect(code).toContain('npm install @sentry/node');
    });

    it('preloads Sentry before Pi Durable starts', () => {
      const code = collectCode(config.configure(makeParams({integration: 'pi'})));

      expect(code).toContain('Sentry.init({');
      expect(code).toContain('dsn: "https://public@o1.ingest.sentry.io/1"');
      expect(code).toContain('node --import ./instrument.mjs');
    });

    it('verifies by running a Pi Durable conversation', () => {
      const steps = config.verify(makeParams({integration: 'pi'}));

      expect(collectCode(steps)).toBe('');
      expect(collectText(steps)).toContain('Pi Durable conversations');
    });

    describe('on Cloudflare', () => {
      const cloudflareParams = makeParams({
        integration: 'pi',
        deploymentTarget: 'cloudflare',
      });

      it('installs the Cloudflare SDK', () => {
        const code = collectCode(config.install(cloudflareParams));

        expect(code).toContain('npm install @sentry/cloudflare');
        expect(code).not.toContain('@sentry/node');
      });

      it('instruments Pi Durable with the Cloudflare Vite plugin', () => {
        const code = collectCode(config.configure(cloudflareParams));

        expect(code).toContain('sentryCloudflareVitePlugin()');
        expect(code).toContain('defineCloudflareOptions((env: Env) => ({');
        expect(code).toContain('nodejs_compat');
        expect(code).toMatch(/compatibility_date = "\d{4}-\d{2}-\d{2}"/);
        expect(code).not.toContain('node --import');
      });
    });

    describe('on Bun', () => {
      const bunParams = {
        ...makeParams({integration: 'pi'}),
        platformKey: 'bun',
      } as DocsParams;

      it('installs the Bun SDK', () => {
        const code = collectCode(config.install(bunParams));

        expect(code).toBe('bun add @sentry/bun');
      });

      it('builds with the Sentry Bun plugin and preloads the instrument file', () => {
        const code = collectCode(config.configure(bunParams));

        expect(code).toContain('import * as Sentry from "@sentry/bun";');
        expect(code).toContain('plugins: [sentryBunPlugin()]');
        expect(code).toContain('bun --preload ./instrument.ts dist/app.js');
      });
    });
  });

  describe('Cloudflare Agents SDK', () => {
    const agentsParams = makeParams({
      integration: 'cloudflare_agents',
      deploymentTarget: 'cloudflare',
    });

    it('configures build-time instrumentation with the Cloudflare Vite plugin', () => {
      const code = collectCode(config.configure(agentsParams));

      expect(code).toContain(
        'import { sentryCloudflareVitePlugin } from "@sentry/cloudflare/vite"'
      );
      expect(code).toContain('plugins: [cloudflare(), sentryCloudflareVitePlugin()]');
      expect(code).toContain('defineCloudflareOptions');
      expect(code).not.toContain('instrumentAgentWithSentry');
      expect(code).not.toContain('Sentry.withSentry(');
      expect(code).not.toContain('Sentry.init(');
    });

    it('installs @sentry/cloudflare at the Agents SDK minimum version', () => {
      const steps = config.install(agentsParams);

      expect(collectCode(steps)).toContain('npm install @sentry/cloudflare');
      expect(collectText(steps)).toContain('10.69.0');
    });

    it('verifies by triggering the agent instead of a raw-SDK snippet', () => {
      const steps = config.verify(agentsParams);

      expect(collectCode(steps)).toBe('');
      expect(collectText(steps)).toContain('Trigger your agent');
    });
  });
});
