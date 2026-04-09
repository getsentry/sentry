interface TokenBreakdown {
  cached: number;
  netNewInput: number;
  output: number;
  total: number;
}

/**
 * Computes a display-ready token breakdown from raw span attributes.
 *
 * Per OTel conventions, `inputTokens` includes cached and `outputTokens`
 * includes reasoning. Some providers don't follow this, so we detect the
 * gap and adjust as a fallback (see `getAdjustedInput` / `getAdjustedOutput`).
 *
 * Returns net-new input (excluding cached), cached, output (including
 * reasoning), and total.
 */
export function getTokenBreakdown({
  inputTokens,
  cachedTokens,
  outputTokens,
  reasoningTokens,
  totalTokens,
}: {
  cachedTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}): TokenBreakdown {
  const cached = isNaN(cachedTokens) ? 0 : cachedTokens;
  const reasoning = isNaN(reasoningTokens) ? 0 : reasoningTokens;

  const adjustedInput = getAdjustedInput(inputTokens, cached, outputTokens, totalTokens);
  const adjustedOutput = getAdjustedOutput(
    adjustedInput,
    outputTokens,
    reasoning,
    totalTokens
  );

  return {
    netNewInput: cached > 0 ? Math.max(0, adjustedInput - cached) : adjustedInput,
    cached,
    output: adjustedOutput,
    total: totalTokens,
  };
}

/**
 * Some providers report `inputTokens` exclusive of cached; others inclusive.
 * We pick whichever interpretation makes `input + output` closest to `total`.
 */
function getAdjustedInput(
  inputTokens: number,
  cachedTokens: number,
  outputTokens: number,
  totalTokens: number
): number {
  if (cachedTokens <= 0) {
    return inputTokens;
  }
  const without = inputTokens + outputTokens;
  const withCached = without + cachedTokens;
  if (Math.abs(withCached - totalTokens) < Math.abs(without - totalTokens)) {
    return inputTokens + cachedTokens;
  }
  return inputTokens;
}

/**
 * Same idea for reasoning tokens inside `outputTokens`.
 */
function getAdjustedOutput(
  adjustedInput: number,
  outputTokens: number,
  reasoningTokens: number,
  totalTokens: number
): number {
  if (reasoningTokens <= 0) {
    return outputTokens;
  }
  const without = adjustedInput + outputTokens;
  const withReasoning = without + reasoningTokens;
  if (Math.abs(withReasoning - totalTokens) < Math.abs(without - totalTokens)) {
    return outputTokens + reasoningTokens;
  }
  return outputTokens;
}
