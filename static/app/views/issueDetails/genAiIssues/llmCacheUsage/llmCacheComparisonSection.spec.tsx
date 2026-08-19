import {render, screen} from 'sentry-test/reactTestingLibrary';

import {LlmCacheComparisonSection} from './llmCacheComparisonSection';
import type {LlmCacheEvidenceData} from './types';

const evidence: LlmCacheEvidenceData = {
  outcome: 'not_caching',
  agentLabel: 'Planner',
  agentLabelSource: 'gen_ai.agent.name',
  spanName: 'generate_content claude-sonnet-4',
  model: 'claude-sonnet-4',
  callCount: 2121,
  warmCallCount: 1951,
  cacheableShare: 0.92,
  hitRate: 0.0487,
  writeReadRatio: null,
  avgInputTokens: 4096,
  uncachedTokens: 8_700_000,
  sumInputTokens: 8_700_000,
  sumCacheReadTokens: 0,
  sumCacheCreationTokens: 0,
  estimatedSavingsUsd: null,
  overpayVsNoCacheUsd: null,
  windowDays: 7,
  windowStart: '2026-08-10T00:00:00+00:00',
  windowEnd: '2026-08-17T00:00:00+00:00',
  promptDivergence: null,
  sampleCalls: [],
  anchor: {
    model: 'claude-sonnet-4',
    agentLabel: 'Summarizer',
    agentLabelSource: 'gen_ai.agent.name',
    spanName: 'generate_content claude-sonnet-4',
    hitRate: 0.8301,
    callCount: 1743,
    avgInputTokens: 2900,
  },
};

describe('LlmCacheComparisonSection', () => {
  it('sets the flagged call site against a healthy one on the same model', () => {
    render(<LlmCacheComparisonSection evidenceData={evidence} />);

    expect(screen.getByText('4.87%')).toBeInTheDocument();
    expect(screen.getByText('83.01%')).toBeInTheDocument();
    expect(
      screen.getByText('Summarizer | generate_content claude-sonnet-4')
    ).toBeInTheDocument();
    expect(screen.getByText('1,743 calls · ~2.9K avg tokens')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Both call sites run claude-sonnet-4 in this project. The difference is how each one builds its prompt.'
      )
    ).toBeInTheDocument();
  });

  it('links each call site to its samples', () => {
    render(<LlmCacheComparisonSection evidenceData={evidence} />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute(
      'href',
      expect.stringContaining('gen_ai.request.model')
    );
  });

  it('renders nothing without an anchor rather than an empty state', () => {
    const {container} = render(
      <LlmCacheComparisonSection evidenceData={{...evidence, anchor: null}} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('omits the volume line when an older occurrence has no anchor stats', () => {
    render(
      <LlmCacheComparisonSection
        evidenceData={{
          ...evidence,
          anchor: {...evidence.anchor!, callCount: null, avgInputTokens: null},
        }}
      />
    );

    // The flagged side still has its own volume; only the anchor's is missing.
    expect(screen.queryByText(/1,743 calls/)).not.toBeInTheDocument();
    expect(screen.getByText('2,121 calls · ~4.1K avg tokens')).toBeInTheDocument();
    expect(screen.getByText('83.01%')).toBeInTheDocument();
  });
});
