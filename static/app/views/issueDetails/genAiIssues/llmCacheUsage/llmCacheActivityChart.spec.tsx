import {render, screen} from 'sentry-test/reactTestingLibrary';

import {LlmCacheActivityChart} from './llmCacheActivityChart';
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
  sampleCalls: [],
  anchor: null,
};

function series(yAxis: string, values: number[]) {
  return {
    yAxis,
    values: values.map((value, index) => ({
      timestamp: 1_760_000_000_000 + index * 3_600_000,
      value,
    })),
    meta: {interval: 3_600_000, valueType: 'number', valueUnit: null},
  };
}

describe('LlmCacheActivityChart', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('queries the call site over the detection window', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [
          series('sum(gen_ai.usage.input_tokens)', [1000, 1000]),
          series('sum(gen_ai.usage.cache_read.input_tokens)', [100, 100]),
          series('sum(gen_ai.usage.cache_creation.input_tokens)', [400, 400]),
        ],
      },
    });

    render(<LlmCacheActivityChart evidenceData={evidence} />);

    expect(await screen.findByText(/Live data for this call site/)).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      '/organizations/org-slug/events-timeseries/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: expect.stringContaining('agent.execute_step'),
        }),
      })
    );
  });

  it('renders nothing when the occurrence predates the emitted window', () => {
    const {container} = render(
      <LlmCacheActivityChart
        evidenceData={{...evidence, windowStart: null, windowEnd: null}}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
