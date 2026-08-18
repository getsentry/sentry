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
        {segments.map(segment => (
          <Flex key={segment.key} align="center" gap="xs">
            <Swatch style={{background: segment.color}} />
            <Text size="sm" variant="muted">
              {t(
                '%s %s (%s)',
                segment.label,
                formatTokens(segment.value),
                `${((segment.value / total) * 100).toFixed(0)}%`
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
