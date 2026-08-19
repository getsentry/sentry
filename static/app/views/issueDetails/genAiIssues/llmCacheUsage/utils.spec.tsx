import {
  buildCallSiteQuery,
  formatCacheEligibleCalls,
  formatCallSiteLabel,
  formatCharacters,
  formatRate,
  formatTokens,
  getCacheProvider,
  getLlmCacheEvidenceData,
} from './utils';

describe('getLlmCacheEvidenceData', () => {
  it('reads a fully populated occurrence', () => {
    const parsed = getLlmCacheEvidenceData({
      outcome: 'thrash',
      agentLabel: 'Executor',
      agentLabelSource: 'gen_ai.agent.name',
      spanName: 'generate_content claude-sonnet-4',
      model: 'claude-sonnet-4',
      callCount: 2121,
      warmCallCount: 1951,
      cacheableShare: 0.92,
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
      contrastAgentLabel: 'Summarizer',
      contrastAgentLabelSource: 'gen_ai.agent.name',
      contrastSpanName: 'generate_content claude-sonnet-4',
      contrastHitRate: 0.83,
      contrastCallCount: 1743,
      contrastAvgInputTokens: 2900,
    });

    expect(parsed.outcome).toBe('thrash');
    expect(parsed.warmCallCount).toBe(1951);
    expect(parsed.cacheableShare).toBe(0.92);
    expect(parsed.sampleCalls).toHaveLength(1);
    expect(parsed.sampleCalls[0]!.spanId).toBe('1'.repeat(16));
    expect(parsed.anchor).toEqual({
      model: 'claude-sonnet-4',
      agentLabel: 'Summarizer',
      agentLabelSource: 'gen_ai.agent.name',
      spanName: 'generate_content claude-sonnet-4',
      hitRate: 0.83,
      callCount: 1743,
      avgInputTokens: 2900,
    });
  });

  it('reads an unrecognized label source as unknown provenance', () => {
    // The source decides how the call site is queried, so a value the page does
    // not understand must not be passed through as if it were an attribute.
    const parsed = getLlmCacheEvidenceData({
      agentLabel: 'Executor',
      agentLabelSource: 'gen_ai.function_id',
      spanName: 'generate_content claude-sonnet-4',
      model: 'claude-sonnet-4',
    });

    expect(parsed.agentLabelSource).toBeNull();
    expect(buildCallSiteQuery(parsed)).toBeNull();
  });

  it('drops a partial contrast anchor rather than rendering half a comparison', () => {
    const parsed = getLlmCacheEvidenceData({
      contrastModel: 'claude-sonnet-4',
      contrastAgentLabel: 'Summarizer',
    });

    expect(parsed.anchor).toBeNull();
  });

  it('reads the prompt diagnosis', () => {
    const parsed = getLlmCacheEvidenceData({
      promptSampleCount: 4,
      promptCommonPrefixChars: 142,
      promptShortestChars: 48_000,
      promptPrefixShare: 0.003,
      promptDivergenceKind: 'iso_timestamp',
      promptStableSuffixChars: 6_200,
      promptTemplateMisordered: true,
    });

    expect(parsed.promptDivergence).toEqual({
      kind: 'iso_timestamp',
      commonPrefixChars: 142,
      shortestChars: 48_000,
      prefixShare: 0.003,
      stableSuffixChars: 6_200,
      templateMisordered: true,
      sampleCount: 4,
    });
  });

  it('has no prompt diagnosis when the spans carried no prompt text', () => {
    // The common case: sending prompts is opt-in and mostly off.
    expect(getLlmCacheEvidenceData({hitRate: 0}).promptDivergence).toBeNull();
  });

  it('drops a prompt diagnosis missing the parts every sentence is built from', () => {
    expect(
      getLlmCacheEvidenceData({
        promptDivergenceKind: 'uuid',
        promptStableSuffixChars: 6_200,
      }).promptDivergence
    ).toBeNull();
  });

  it('reads an unrecognized divergence kind as no diagnosis at all', () => {
    // A kind the page cannot describe would render a sentence with a hole in it.
    expect(
      getLlmCacheEvidenceData({
        promptDivergenceKind: 'semver',
        promptCommonPrefixChars: 142,
      }).promptDivergence
    ).toBeNull();
  });

  it('reads a missing misordering verdict as no verdict', () => {
    const parsed = getLlmCacheEvidenceData({
      promptDivergenceKind: 'counter',
      promptCommonPrefixChars: 142,
    });

    expect(parsed.promptDivergence?.templateMisordered).toBe(false);
    expect(parsed.promptDivergence?.stableSuffixChars).toBeNull();
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
        agentLabel: 'Execute Step',
        agentLabelSource: 'gen_ai.agent.name',
        spanName: 'chat claude sonnet',
        model: 'claude-sonnet-4',
      })
    ).toBe(
      'gen_ai.operation.type:ai_client !gen_ai.operation.name:embeddings has:gen_ai.usage.input_tokens gen_ai.agent.name:"Execute Step" span.name:"chat claude sonnet" gen_ai.request.model:claude-sonnet-4'
    );
  });

  it('requires the agent name to be absent for an operation-name label', () => {
    // Without the absence term the query also returns the spans that do name an
    // agent and happen to share the operation, which are another call site.
    expect(
      buildCallSiteQuery({
        agentLabel: 'generate_content',
        agentLabelSource: 'gen_ai.operation.name',
        spanName: 'generate_content gemini',
        model: 'gemini-2.5-pro',
      })
    ).toBe(
      'gen_ai.operation.type:ai_client !gen_ai.operation.name:embeddings has:gen_ai.usage.input_tokens !has:gen_ai.agent.name gen_ai.operation.name:generate_content span.name:"generate_content gemini" gen_ai.request.model:gemini-2.5-pro'
    );
  });

  it('escapes a wildcard so a call site cannot match its siblings', () => {
    // An unescaped `*` would silently become a LIKE and pull in every sibling.
    const query = buildCallSiteQuery({
      agentLabel: 'Chat',
      agentLabelSource: 'gen_ai.agent.name',
      spanName: 'chat */gpt-4',
      model: 'gpt-4',
    });

    expect(query).toContain(String.raw`span.name:"chat \*/gpt-4"`);
  });

  it('escapes a quote so the term cannot be terminated early', () => {
    const query = buildCallSiteQuery({
      agentLabel: 'say "hi"',
      agentLabelSource: 'gen_ai.agent.name',
      spanName: 'chat gpt-4',
      model: 'gpt-4',
    });

    expect(query).toContain(String.raw`gen_ai.agent.name:"say \"hi\""`);
  });

  it('declines a value the grammar cannot match exactly', () => {
    // A trailing backslash escapes the term's own closing quote; a backslash
    // before a star is an escaped wildcard however the star is written.
    expect(
      buildCallSiteQuery({
        agentLabel: 'C:\\path\\',
        agentLabelSource: 'gen_ai.agent.name',
        spanName: 'chat gpt-4',
        model: 'gpt-4',
      })
    ).toBeNull();
    expect(
      buildCallSiteQuery({
        agentLabel: String.raw`literal\*star`,
        agentLabelSource: 'gen_ai.agent.name',
        spanName: 'chat gpt-4',
        model: 'gpt-4',
      })
    ).toBeNull();
  });

  it('declines when the call site is not fully known', () => {
    expect(
      buildCallSiteQuery({
        agentLabel: null,
        agentLabelSource: 'gen_ai.agent.name',
        spanName: 'chat gpt-4',
        model: 'gpt-4',
      })
    ).toBeNull();
  });
});

describe('formatCallSiteLabel', () => {
  it('does not repeat an agent the span name already carries', () => {
    expect(
      formatCallSiteLabel({
        agentLabel: 'Lightweight RCA',
        spanName: 'invoke_agent Lightweight RCA',
      })
    ).toBe('invoke_agent Lightweight RCA');
  });

  it('names the agent when the span name is only the SDK wrapper', () => {
    expect(
      formatCallSiteLabel({agentLabel: 'Explorer', spanName: 'generate_content gemini'})
    ).toBe('Explorer | generate_content gemini');
  });

  it('renders whichever half an older occurrence carries', () => {
    expect(formatCallSiteLabel({agentLabel: 'Explorer', spanName: null})).toBe(
      'Explorer'
    );
    expect(formatCallSiteLabel({agentLabel: null, spanName: null})).toBe('Unknown');
  });
});

describe('formatTokens', () => {
  it('rolls up to millions rather than printing 1000.0K', () => {
    expect(formatTokens(999_999)).toBe('~1.0M');
    expect(formatTokens(999_400)).toBe('~999.4K');
  });
});

describe('formatCharacters', () => {
  it('reads as a length rather than a bare number', () => {
    expect(formatCharacters(142)).toBe('142 chars');
    expect(formatCharacters(6_200)).toBe('~6.2K chars');
    expect(formatCharacters(null)).toBe('Unknown');
  });
});

describe('formatRate', () => {
  it('clamps a hit rate above 100%', () => {
    // Providers that report input exclusive of cached tokens can drive reads
    // past input.
    expect(formatRate(2.5)).toBe('100.00%');
  });
});

describe('formatCacheEligibleCalls', () => {
  it('reads as a count against the whole workload', () => {
    expect(formatCacheEligibleCalls(1951, 0.92)).toBe('1,951 (92.00% of calls)');
  });

  it('keeps the count when an occurrence carries no share', () => {
    expect(formatCacheEligibleCalls(1951, null)).toBe('1,951');
  });

  it('has nothing to say without a count', () => {
    expect(formatCacheEligibleCalls(null, 0.92)).toBe('Unknown');
  });
});
