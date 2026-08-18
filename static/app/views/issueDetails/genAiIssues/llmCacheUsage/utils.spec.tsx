import {
  buildCallSiteQuery,
  formatRate,
  formatTokens,
  getCacheProvider,
  getLlmCacheEvidenceData,
} from './utils';

describe('getLlmCacheEvidenceData', () => {
  it('reads a fully populated occurrence', () => {
    const parsed = getLlmCacheEvidenceData({
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
      estimatedSavingsUsd: 41.2,
      overpayVsNoCacheUsd: 3.5,
      windowDays: 7,
      windowStart: '2026-08-10T00:00:00+00:00',
      windowEnd: '2026-08-17T00:00:00+00:00',
      sampleTraces: [
        {
          traceId: 'a'.repeat(32),
          spanId: '1'.repeat(16),
          timestamp: '2026-08-15T00:00:00+00:00',
          inputTokens: 4709,
          cacheReadTokens: 229,
          cacheCreationTokens: 2759,
        },
      ],
      contrastModel: 'claude-sonnet-4',
      contrastTransaction: 'agent.summarize',
      contrastSpanDescription: 'generate_content claude-sonnet-4',
      contrastHitRate: 0.83,
      contrastCallCount: 1743,
      contrastAvgInputTokens: 2900,
    });

    expect(parsed.outcome).toBe('thrash');
    expect(parsed.sampleCalls).toHaveLength(1);
    expect(parsed.sampleCalls[0]!.spanId).toBe('1'.repeat(16));
    expect(parsed.anchor).toEqual({
      model: 'claude-sonnet-4',
      transaction: 'agent.summarize',
      spanDescription: 'generate_content claude-sonnet-4',
      hitRate: 0.83,
      callCount: 1743,
      avgInputTokens: 2900,
    });
  });

  it('falls back to bare trace ids from older occurrences', () => {
    // Occurrences produced before the detector emitted per-call detail still
    // have to render something linkable.
    const parsed = getLlmCacheEvidenceData({
      sampleTraceIds: ['a'.repeat(32), 'b'.repeat(32)],
    });

    expect(parsed.sampleCalls).toEqual([
      {
        traceId: 'a'.repeat(32),
        spanId: null,
        timestamp: null,
        inputTokens: null,
        cacheReadTokens: null,
        cacheCreationTokens: null,
      },
      {
        traceId: 'b'.repeat(32),
        spanId: null,
        timestamp: null,
        inputTokens: null,
        cacheReadTokens: null,
        cacheCreationTokens: null,
      },
    ]);
  });

  it('drops a partial contrast anchor rather than rendering half a comparison', () => {
    const parsed = getLlmCacheEvidenceData({
      contrastModel: 'claude-sonnet-4',
      contrastTransaction: 'agent.summarize',
    });

    expect(parsed.anchor).toBeNull();
  });

  it('ignores an unrecognized outcome', () => {
    expect(getLlmCacheEvidenceData({outcome: 'something-new'}).outcome).toBeNull();
  });

  it('tolerates an empty occurrence', () => {
    const parsed = getLlmCacheEvidenceData(undefined);

    expect(parsed.outcome).toBeNull();
    expect(parsed.anchor).toBeNull();
    expect(parsed.sampleCalls).toEqual([]);
    expect(parsed.hitRate).toBeNull();
  });
});

describe('getCacheProvider', () => {
  it.each([
    ['claude-sonnet-4', 'anthropic'],
    ['anthropic/claude-3-5-haiku', 'anthropic'],
    ['gemini-2.5-pro', 'google'],
    ['gpt-4o-mini', 'openai'],
    ['o3-pro', 'openai'],
    ['some-self-hosted-model', 'unknown'],
  ])('maps %s to %s', (model, expected) => {
    expect(getCacheProvider(model)).toBe(expected);
  });
});

describe('buildCallSiteQuery', () => {
  it('quotes values so a call site with spaces stays one term', () => {
    expect(
      buildCallSiteQuery({
        transaction: 'agent.execute step',
        spanDescription: 'chat claude sonnet',
        model: 'claude-sonnet-4',
      })
    ).toBe(
      'gen_ai.operation.type:ai_client !gen_ai.operation.name:embeddings has:gen_ai.usage.input_tokens transaction:"agent.execute step" span.description:"chat claude sonnet" gen_ai.request.model:claude-sonnet-4'
    );
  });

  it('escapes a wildcard so a clustered transaction cannot match its siblings', () => {
    // `transaction` and `span.description` are wildcard-allowed fields, so an
    // unescaped `*` from the transaction clusterer would silently become a LIKE
    // and pull in every sibling route.
    const query = buildCallSiteQuery({
      transaction: '/api/v1/*/chat',
      spanDescription: 'chat gpt-4',
      model: 'gpt-4',
    });

    expect(query).toContain(String.raw`transaction:"/api/v1/\*/chat"`);
  });

  it('escapes a quote so the term cannot be terminated early', () => {
    const query = buildCallSiteQuery({
      transaction: 'say "hi"',
      spanDescription: 'chat gpt-4',
      model: 'gpt-4',
    });

    expect(query).toContain(String.raw`transaction:"say \"hi\""`);
  });

  it('declines a value the grammar cannot match exactly', () => {
    // A trailing backslash escapes the term's own closing quote; a backslash
    // before a star is an escaped wildcard however the star is written.
    expect(
      buildCallSiteQuery({
        transaction: 'C:\\path\\',
        spanDescription: 'chat gpt-4',
        model: 'gpt-4',
      })
    ).toBeNull();
    expect(
      buildCallSiteQuery({
        transaction: String.raw`literal\*star`,
        spanDescription: 'chat gpt-4',
        model: 'gpt-4',
      })
    ).toBeNull();
  });

  it('declines when the call site is not fully known', () => {
    expect(
      buildCallSiteQuery({transaction: null, spanDescription: 'chat', model: 'gpt-4'})
    ).toBeNull();
  });
});

describe('formatTokens', () => {
  it('rolls up to millions rather than printing 1000.0K', () => {
    expect(formatTokens(999_999)).toBe('~1.0M');
    expect(formatTokens(999_400)).toBe('~999.4K');
  });
});

describe('formatRate', () => {
  it('clamps a hit rate above 100%', () => {
    // Providers that report input exclusive of cached tokens can drive reads
    // past input.
    expect(formatRate(2.5)).toBe('100.00%');
  });
});
