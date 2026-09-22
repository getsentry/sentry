import type {
  DocsParams,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getNodeMcpOnboarding} from 'sentry/gettingStartedDocs/node/utils';

const DATA_COLLECTION_TITLE = 'Control the Data You Send to Sentry (Optional)';

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

describe('getNodeMcpOnboarding data collection step', () => {
  const config = getNodeMcpOnboarding();

  it.each(['mcp_sdk', 'manual'])('offers the genAI opt-out for %s', integration => {
    const steps = config.configure!(makeParams({integration}));
    const dataCollectionSteps = steps.filter(
      (step: OnboardingStep) => step.title === DATA_COLLECTION_TITLE
    );

    expect(dataCollectionSteps).toHaveLength(1);
    // The MCP onboarding renders `GuidedSteps`, which drops every collapsible
    // step, so a collapsible step here would never be shown.
    expect(dataCollectionSteps[0]!.collapsible).toBeFalsy();

    const code = dataCollectionSteps
      .flatMap(step => step.content ?? [])
      .flatMap(block =>
        block.type === 'code' && 'tabs' in block ? block.tabs.map(tab => tab.code) : []
      )
      .join('\n');
    expect(code).toContain('genAI: { inputs: false, outputs: false }');
  });
});
