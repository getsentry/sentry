import {render, screen} from 'sentry-test/reactTestingLibrary';

import {LlmCacheExampleCalls} from './llmCacheExampleCalls';
import type {LlmCacheEvidenceData} from './types';

const evidence: LlmCacheEvidenceData = {
  outcome: 'thrash',
  transaction: 'agent.execute_step',
  spanDescription: 'generate_content claude-sonnet-4',
  model: 'claude-sonnet-4',
  callCount: 2121,
  hitRate: 0.0487,
  writeReadRatio: 12,
  avgInputTokens: 4096,
  uncachedTokens: 3_200_000,
  sumInputTokens: 8_700_000,
  sumCacheReadTokens: 424_400,
  sumCacheCreationTokens: 5_100_000,
  estimatedSavingsUsd: null,
  overpayVsNoCacheUsd: null,
  windowDays: 7,
  windowStart: '2026-08-10T00:00:00+00:00',
  windowEnd: '2026-08-17T00:00:00+00:00',
  anchor: null,
  sampleCalls: [
    {
      traceId: 'abcdef01'.padEnd(32, '0'),
      spanId: '1'.repeat(16),
      timestamp: '2026-08-15T12:00:00+00:00',
      inputTokens: 12_400,
      cacheReadTokens: 0,
      cacheCreationTokens: 8_000,
    },
  ],
};

describe('LlmCacheExampleCalls', () => {
  it('links a sample to the span that made the call, not just its trace', () => {
    render(<LlmCacheExampleCalls evidenceData={evidence} />);

    const link = screen.getByRole('link', {name: 'abcdef01'});
    // The span id is what lands the reader on the gen-AI call inside the trace,
    // and the timestamp is how the trace view finds a trace this old at all.
    expect(link).toHaveAttribute('href', expect.stringContaining('1111111111111111'));
    expect(link).toHaveAttribute('href', expect.stringContaining('timestamp'));
    expect(screen.getByText('~12.4K input · 0 cached')).toBeInTheDocument();
  });

  it('still links bare trace ids from older occurrences', () => {
    render(
      <LlmCacheExampleCalls
        evidenceData={{
          ...evidence,
          sampleCalls: [
            {
              traceId: 'beefbeef'.padEnd(32, '0'),
              spanId: null,
              timestamp: null,
              inputTokens: null,
              cacheReadTokens: null,
              cacheCreationTokens: null,
            },
          ],
        }}
      />
    );

    expect(screen.getByRole('link', {name: 'beefbeef'})).toBeInTheDocument();
    expect(screen.getByText('View trace')).toBeInTheDocument();
  });

  it('renders nothing when the detector attached no samples', () => {
    const {container} = render(
      <LlmCacheExampleCalls evidenceData={{...evidence, sampleCalls: []}} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
