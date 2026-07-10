import {useTheme} from '@emotion/react';

import {Container, Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  getGenAiOpType,
  getGenAiOpTypeIcon,
  getSpanColor,
  getTimelineColorByOpType,
  hasError,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

type IconSize = 'xs' | 'sm' | 'md' | 'lg';

// Corner offset for the error badge, tuned per icon size so the fire sits just
// outside the bottom-right of the op-type icon.
const BADGE_OFFSET: Record<IconSize, number> = {xs: -4, sm: -5, md: -6, lg: -7};

interface AiSpanStatusIconProps {
  node: AITraceSpanNode;
  /**
   * Overrides the icon color. Defaults to the op-type/error palette color so
   * errored spans tint red.
   */
  color?: string;
  size?: IconSize;
}

/**
 * Op-type icon for an AI span with a shared errored treatment: a small
 * `IconFire` badge overlapping the bottom-right corner when the span errored.
 * Used across the timeline, transcript, and span detail so the errored icon
 * looks the same everywhere.
 */
export function AiSpanStatusIcon({node, size = 'md', color}: AiSpanStatusIconProps) {
  const theme = useTheme();
  const hasErrors = hasError(node);
  const iconColor = color ?? getSpanColor(node, getTimelineColorByOpType(theme));
  const offset = BADGE_OFFSET[size];

  return (
    <Flex align="center" position="relative" style={{color: iconColor}} flexShrink={0}>
      {getGenAiOpTypeIcon(getGenAiOpType(node), size)}
      {hasErrors && (
        <Tooltip title={t('This span encountered an error')} skipWrapper>
          <Container
            position="absolute"
            radius="full"
            style={{
              bottom: offset,
              right: offset,
              padding: 1,
              background: theme.tokens.background.primary,
            }}
          >
            <IconFire display="block" size="xs" variant="danger" />
          </Container>
        </Tooltip>
      )}
    </Flex>
  );
}
