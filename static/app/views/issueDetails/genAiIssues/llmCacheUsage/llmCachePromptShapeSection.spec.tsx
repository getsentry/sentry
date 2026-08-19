import {render, screen} from 'sentry-test/reactTestingLibrary';

import {LlmCachePromptShapeSection} from './llmCachePromptShapeSection';
import type {LlmCacheEvidenceData, LlmCachePromptDivergence} from './types';

const divergence: LlmCachePromptDivergence = {
  kind: 'iso_timestamp',
  commonPrefixChars: 142,
  shortestChars: 48_000,
  prefixShare: 0.003,
  stableSuffixChars: 6_200,
  templateMisordered: true,
  sampleCount: 4,
};

const evidence: LlmCacheEvidenceData = {
  outcome: 'not_caching',
  agentLabel: 'Planner',
  agentLabelSource: 'gen_ai.agent.name',
  spanName: 'generate_content claude-sonnet-4',
  model: 'claude-sonnet-4',
  callCount: 2121,
  warmCallCount: 1951,
  cacheableShare: 0.92,
  hitRate: 0,
  writeReadRatio: null,
  avgInputTokens: 12_000,
  uncachedTokens: 8_700_000,
  sumInputTokens: 8_700_000,
  sumCacheReadTokens: 0,
  sumCacheCreationTokens: 0,
  estimatedSavingsUsd: null,
  overpayVsNoCacheUsd: null,
  windowDays: 7,
  windowStart: null,
  windowEnd: null,
  sampleCalls: [],
  anchor: null,
  promptDivergence: divergence,
};

describe('LlmCachePromptShapeSection', () => {
  it('says the stable content is sitting behind the part that changes', () => {
    render(<LlmCachePromptShapeSection evidenceData={evidence} />);

    expect(
      screen.getByText(/The stable part of this prompt sits behind the part that changes/)
    ).toBeInTheDocument();
    expect(screen.getByText('Shared prompt prefix')).toBeInTheDocument();
    expect(screen.getByText('142 chars (0.30% of the prompt)')).toBeInTheDocument();
    expect(screen.getByText('Prompts first differ at')).toBeInTheDocument();
    expect(screen.getAllByText('an ISO-8601 timestamp').length).toBeGreaterThan(0);
    expect(screen.getByText('Identical content after it')).toBeInTheDocument();
    // Both the sentence and the row carry it.
    expect(screen.getAllByText('~6.2K chars')).toHaveLength(2);
    expect(
      screen.getByText('Measured on 4 recent invocations of this call site.')
    ).toBeInTheDocument();
  });

  it('does not blame the template when the shared prefix is already long enough', () => {
    render(
      <LlmCachePromptShapeSection
        evidenceData={{
          ...evidence,
          promptDivergence: {...divergence, templateMisordered: false},
        }}
      />
    );

    expect(
      screen.getByText(/A provider caches a prefix and only a prefix/)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/The stable part of this prompt sits behind/)
    ).not.toBeInTheDocument();
  });

  it('points away from the prompt when the samples never diverged', () => {
    render(
      <LlmCachePromptShapeSection
        evidenceData={{
          ...evidence,
          promptDivergence: {
            ...divergence,
            kind: 'none',
            stableSuffixChars: 0,
            templateMisordered: false,
          },
        }}
      />
    );

    expect(
      screen.getByText(/the prompt text is not what breaks the cache here/)
    ).toBeInTheDocument();
    // There is no first difference to name, and nothing follows one.
    expect(screen.queryByText('Prompts first differ at')).not.toBeInTheDocument();
    expect(screen.queryByText('Identical content after it')).not.toBeInTheDocument();
  });

  it('renders nothing for an occurrence that carries no prompt diagnosis', () => {
    const {container} = render(
      <LlmCachePromptShapeSection evidenceData={{...evidence, promptDivergence: null}} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
