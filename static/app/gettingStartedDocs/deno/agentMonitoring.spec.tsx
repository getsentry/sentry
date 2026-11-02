import type {
  DocsParams,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {reactNodeToText} from 'sentry/components/onboarding/utils/stepsToMarkdown';
import {agentMonitoring} from 'sentry/gettingStartedDocs/deno/agentMonitoring';

function makeParams(platformOptions: Record<string, string> = {}): DocsParams {
  return {
    dsn: {public: 'https://public@o1.ingest.sentry.io/1'},
    platformKey: 'deno',
    platformOptions,
    project: {id: '1', slug: 'project-slug', platform: 'deno'},
    isProfilingSelected: false,
    isLogsSelected: false,
    isFeedbackSelected: false,
    isMetricsSelected: false,
    isPerformanceSelected: true,
    isReplaySelected: false,
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

describe('deno agentMonitoring onboarding', () => {
  describe('Pi Durable', () => {
    const params = makeParams({integration: 'pi'});

    it('imports the Deno SDK from npm', () => {
      const code = collectCode(agentMonitoring.install!(params));

      expect(code).toBe('import * as Sentry from "npm:@sentry/deno";');
    });

    it('preloads the Sentry import hook', () => {
      const code = collectCode(agentMonitoring.configure(params));

      expect(code).toContain('Sentry.init({');
      expect(code).toContain('dsn: "https://public@o1.ingest.sentry.io/1"');
      expect(code).toContain('--preload=npm:@sentry/deno/import');
    });

    it('only allows network access to the Sentry ingest host', () => {
      const code = collectCode(agentMonitoring.configure(params));

      expect(code).toContain('--allow-net=o1.ingest.sentry.io \\');
      expect(code).not.toMatch(/--allow-net(\s|$)/);
      expect(code).not.toContain('--allow-write');
    });

    it('verifies by running a Pi Durable conversation', () => {
      const steps = agentMonitoring.verify(params);

      expect(collectText(steps)).toContain('Pi Durable conversations');
    });
  });

  describe.each([
    ['openai', 'npm:openai'],
    ['anthropic', 'npm:@anthropic-ai/sdk'],
    ['google_genai', 'npm:@google/genai'],
    ['langchain', 'npm:@langchain/openai'],
    ['langgraph', 'npm:@langchain/langgraph/prebuilt'],
  ])('%s', (integration, verifyImport) => {
    const params = makeParams({integration});

    it('requires the SDK version that auto-instruments it', () => {
      const text = collectText(agentMonitoring.install!(params));

      expect(text).toContain('11.0.0');
    });

    it('preloads the Sentry import hook', () => {
      const code = collectCode(agentMonitoring.configure(params));

      expect(code).toContain('import * as Sentry from "npm:@sentry/deno";');
      expect(code).toContain('"nodeModulesDir": "auto"');
      expect(code).toContain('--allow-net=o1.ingest.sentry.io \\');
      expect(code).toContain('--preload=npm:@sentry/deno/import');
      expect(code).not.toContain('experimental_telemetry');
    });

    it('verifies with a Deno-compatible snippet', () => {
      const code = collectCode(agentMonitoring.verify(params));

      expect(code).toContain(verifyImport);
      expect(code).not.toContain('require(');
    });
  });

  it('keeps the Vercel AI SDK setup as the default', () => {
    const code = collectCode(agentMonitoring.configure(makeParams()));

    expect(code).toContain('experimental_telemetry');
    expect(code).not.toContain('--preload');
  });
});
