import {getTokenBreakdown} from './tokenBreakdown';

describe('getTokenBreakdown', () => {
  it('returns input as netNewInput when there are no cached tokens', () => {
    const result = getTokenBreakdown({
      inputTokens: 100,
      cachedTokens: 0,
      outputTokens: 50,
      reasoningTokens: 0,
      totalTokens: 150,
    });

    expect(result).toEqual({
      netNewInput: 100,
      cached: 0,
      output: 50,
      total: 150,
    });
  });

  it('separates cached from input when cached is included (OTel convention)', () => {
    // OTel: inputTokens=100 includes 80 cached, output=50, total=150
    const result = getTokenBreakdown({
      inputTokens: 100,
      cachedTokens: 80,
      outputTokens: 50,
      reasoningTokens: 0,
      totalTokens: 150,
    });

    expect(result).toEqual({
      netNewInput: 20,
      cached: 80,
      output: 50,
      total: 150,
    });
  });

  it('handles providers that report input exclusive of cached', () => {
    // Some providers: inputTokens=30 (net new only), cached=80, output=90, total=200
    // getAdjustedInput detects that 30+90+80=200 matches total, so adjusts input to 110
    const result = getTokenBreakdown({
      inputTokens: 30,
      cachedTokens: 80,
      outputTokens: 90,
      reasoningTokens: 0,
      totalTokens: 200,
    });

    expect(result).toEqual({
      netNewInput: 30,
      cached: 80,
      output: 90,
      total: 200,
    });
  });

  it('clamps netNewInput to 0 when cached exceeds input (inconsistent data)', () => {
    // Bad data: provider says cached=80 but input=50, and heuristic decides cached is included
    // input+output=100 is closer to total=100 than input+output+cached=180
    const result = getTokenBreakdown({
      inputTokens: 50,
      cachedTokens: 80,
      outputTokens: 50,
      reasoningTokens: 0,
      totalTokens: 100,
    });

    expect(result.netNewInput).toBeGreaterThanOrEqual(0);
  });

  it('folds reasoning into output tokens (OTel convention)', () => {
    // OTel: outputTokens=100 includes 30 reasoning, total=200
    const result = getTokenBreakdown({
      inputTokens: 100,
      cachedTokens: 0,
      outputTokens: 100,
      reasoningTokens: 30,
      totalTokens: 200,
    });

    expect(result).toEqual({
      netNewInput: 100,
      cached: 0,
      output: 100,
      total: 200,
    });
  });

  it('adjusts output when reasoning is reported separately', () => {
    // Provider reports output=70 exclusive of reasoning=30, total=200
    // getAdjustedOutput detects that 100+70+30=200 matches total
    const result = getTokenBreakdown({
      inputTokens: 100,
      cachedTokens: 0,
      outputTokens: 70,
      reasoningTokens: 30,
      totalTokens: 200,
    });

    expect(result).toEqual({
      netNewInput: 100,
      cached: 0,
      output: 100,
      total: 200,
    });
  });

  it('handles both cached and reasoning adjustments together', () => {
    // input=20 (net new), cached=80 (exclusive), output=50 (exclusive of reasoning=30), total=180
    const result = getTokenBreakdown({
      inputTokens: 20,
      cachedTokens: 80,
      outputTokens: 50,
      reasoningTokens: 30,
      totalTokens: 180,
    });

    expect(result).toEqual({
      netNewInput: 20,
      cached: 80,
      output: 80,
      total: 180,
    });
  });

  it('treats NaN cached as 0', () => {
    const result = getTokenBreakdown({
      inputTokens: 100,
      cachedTokens: NaN,
      outputTokens: 50,
      reasoningTokens: 0,
      totalTokens: 150,
    });

    expect(result).toEqual({
      netNewInput: 100,
      cached: 0,
      output: 50,
      total: 150,
    });
  });

  it('treats NaN reasoning as 0', () => {
    const result = getTokenBreakdown({
      inputTokens: 100,
      cachedTokens: 0,
      outputTokens: 50,
      reasoningTokens: NaN,
      totalTokens: 150,
    });

    expect(result).toEqual({
      netNewInput: 100,
      cached: 0,
      output: 50,
      total: 150,
    });
  });
});
