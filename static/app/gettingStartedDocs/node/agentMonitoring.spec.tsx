import type {
  DocsParams,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {reactNodeToText} from 'sentry/components/onboarding/utils/stepsToMarkdown';
import {agentMonitoring} from 'sentry/gettingStartedDocs/node/agentMonitoring';

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

  describe('Eve', () => {
    it('installs via the eve CLI instead of an npm package', () => {
      const code = collectCode(config.install(makeParams({integration: 'eve'})));

      expect(code).toContain('eve add instrumentation/sentry');
      expect(code).not.toContain('npm install @sentry/node');
    });

    it('configures the OTLP endpoint and public key from the DSN, without Sentry.init', () => {
      const code = collectCode(config.configure(makeParams({integration: 'eve'})));

      expect(code).toContain(
        'SENTRY_OTLP_TRACES_ENDPOINT="https://o1.ingest.sentry.io/api/1/otlp/v1/traces"'
      );
      // The bare public key, not the full DSN
      expect(code).toContain('SENTRY_PUBLIC_KEY="public"');
      expect(code).toContain('defineInstrumentation');
      expect(code).not.toContain('Sentry.init(');
      expect(code).not.toContain('Sentry.withSentry(');
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

  describe('Cloudflare Agents SDK', () => {
    const agentsParams = makeParams({
      integration: 'cloudflare_agents',
      deploymentTarget: 'cloudflare',
    });

    it('wraps the agent class with instrumentAgentWithSentry', () => {
      const code = collectCode(config.configure(agentsParams));

      expect(code).toContain('Sentry.instrumentAgentWithSentry(');
      expect(code).toContain('import * as Sentry from "@sentry/cloudflare"');
      expect(code).toContain('enableRpcTracePropagation: true');
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
