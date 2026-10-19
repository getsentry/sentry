import type {
  DocsParams,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {agentMonitoring} from 'sentry/gettingStartedDocs/python/agentMonitoring';
import {mcp} from 'sentry/gettingStartedDocs/python/mcp';
import {AgentIntegration} from 'sentry/views/insights/pages/agents/utils/agentIntegrations';

function makeParams(platformOptions: Record<string, string> = {}): DocsParams {
  return {
    dsn: {public: 'https://public@o1.ingest.sentry.io/1'},
    platformOptions,
    project: {id: '1', slug: 'project-slug', platform: 'python'},
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

const RECORD_MESSAGES = 'data_collection={"gen_ai": {"inputs": True, "outputs": True}},';

describe('python agentMonitoring onboarding', () => {
  it.each([
    AgentIntegration.OPENAI,
    AgentIntegration.OPENAI_AGENTS,
    AgentIntegration.ANTHROPIC,
    AgentIntegration.GOOGLE_GENAI,
    AgentIntegration.LANGCHAIN,
    AgentIntegration.LANGGRAPH,
    AgentIntegration.LITELLM,
    AgentIntegration.PYDANTIC_AI,
    AgentIntegration.MANUAL,
  ])('records AI inputs and outputs for %s', integration => {
    const code = collectCode(agentMonitoring.configure(makeParams({integration})));

    expect(code).toContain('sentry_sdk.init(');
    expect(code).toContain(RECORD_MESSAGES);
  });

  it('installs an SDK version that supports data_collection', () => {
    const code = collectCode(agentMonitoring.install(makeParams()));

    expect(code).toContain('sentry-sdk>=2.70.0');
  });
});

describe('python mcp onboarding', () => {
  it('records MCP inputs and outputs', () => {
    const code = collectCode(mcp.configure(makeParams({integration: 'mcp_sdk'})));

    expect(code).toContain(RECORD_MESSAGES);
  });

  it('installs an SDK version that supports data_collection', () => {
    const code = collectCode(mcp.install(makeParams({integration: 'mcp_sdk'})));

    expect(code).toContain('sentry-sdk>=2.70.0');
  });
});
