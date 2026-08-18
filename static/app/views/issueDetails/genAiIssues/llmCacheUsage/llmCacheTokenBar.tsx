import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

import {formatTokens} from './utils';

interface LlmCacheTokenBarProps {
  cacheCreationTokens: number | null;
  cacheReadTokens: number | null;
  inputTokens: number | null;
}

/**
 * Whole-percent shares that add up to exactly 100.
 *
 * Rounding each share on its own lets the three labels read 37/59/5 under a bar
 * that visibly fills its track. The leftover percent goes to whichever shares
 * were cut by the most, so the one that absorbs it is the one with the best
 * claim to it.
 */
function toWholePercentages(values: number[], total: number): number[] {
  const exact = values.map(value => (value / total) * 100);
  const percentages = exact.map(Math.floor);
  const leftover = 100 - percentages.reduce((sum, value) => sum + value, 0);

  const byLargestRemainder = exact
    .map((value, index) => ({index, remainder: value - Math.floor(value)}))
    .sort((a, b) => b.remainder - a.remainder);

  for (const {index} of byLargestRemainder.slice(0, leftover)) {
    percentages[index]! += 1;
  }

  return percentages;
}

/**
 * The window's input tokens split by how they were billed.
 *
 * This is the finding in one picture: a call site that never caches is almost
 * entirely uncached, and one that thrashes is a fat write band next to a sliver
 * of reads.
 */
export function LlmCacheTokenBar({
  inputTokens,
  cacheReadTokens,
  cacheCreationTokens,
}: LlmCacheTokenBarProps) {
  const theme = useTheme();

  if (inputTokens === null) {
    return null;
  }

  const reads = cacheReadTokens ?? 0;
  const writes = cacheCreationTokens ?? 0;
  // Providers that report input exclusive of cached tokens would drive this
  // negative; the detector clamps it the same way.
  const uncached = Math.max(inputTokens - reads - writes, 0);
  const total = reads + writes + uncached;

  if (total <= 0) {
    return null;
  }

  const segments = [
    {
      key: 'uncached',
      label: t('Uncached'),
      value: uncached,
      color: theme.tokens.graphics.neutral.moderate,
    },
    {
      key: 'writes',
      label: t('Cache writes'),
      value: writes,
      color: theme.tokens.graphics.promotion.vibrant,
    },
    {
      key: 'reads',
      label: t('Cache reads'),
      value: reads,
      color: theme.tokens.graphics.success.vibrant,
    },
  ].filter(segment => segment.value > 0);

  const percentages = toWholePercentages(
    segments.map(segment => segment.value),
    total
  );

  return (
    <Stack gap="sm">
      <Flex height="12px" radius="sm" overflow="hidden">
        {segments.map(segment => (
          <Segment
            key={segment.key}
            style={{flexGrow: segment.value, background: segment.color}}
          />
        ))}
      </Flex>
      <Flex gap="lg" wrap="wrap">
        {segments.map((segment, index) => (
          <Flex key={segment.key} align="center" gap="xs">
            <Swatch style={{background: segment.color}} />
            <Text size="sm" variant="muted">
              {t(
                '%s %s (%s)',
                segment.label,
                formatTokens(segment.value),
                `${percentages[index]}%`
              )}
            </Text>
          </Flex>
        ))}
      </Flex>
    </Stack>
  );
}

const Segment = styled('div')`
  min-width: 2px;
`;

const Swatch = styled('div')`
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
`;
