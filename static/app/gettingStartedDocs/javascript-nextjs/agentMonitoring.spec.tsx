import type {
  DocsParams,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {reactNodeToText} from 'sentry/components/onboarding/utils/stepsToMarkdown';

import {docs} from './index';

function makeParams(platformOptions: Record<string, string> = {}): DocsParams {
  return {
    dsn: {public: 'https://public@o1.ingest.sentry.io/1'},
    platformOptions,
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

describe('Next.js agentMonitoring onboarding', () => {
  it.each([
    ['openai', 'openai'],
    ['anthropic', '@anthropic-ai/sdk'],
    ['google_genai', '@google/genai'],
    ['langchain', '@langchain/openai'],
    ['langgraph', '@langchain/langgraph/prebuilt'],
  ] as const)(
    'keeps server configuration and verification for %s on Next.js',
    (integration, sdk) => {
      const frameworkConfig = docs.agentMonitoringOnboarding!;
      const params = makeParams({integration});
      const steps = frameworkConfig.configure(params);

      expect(collectCode(steps)).toContain('@sentry/nextjs');
      expect(collectText(steps)).toContain('will be enabled automatically');
      const codeBlock = steps[0]?.content?.find(block => block.type === 'code');
      expect(codeBlock).toMatchObject({tabs: [{label: 'sentry.server.config.(ts|js)'}]});
      expect(collectCode(frameworkConfig.verify(params))).toContain(sdk);
    }
  );
});
