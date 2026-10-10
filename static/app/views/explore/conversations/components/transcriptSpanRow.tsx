import type {ReactNode} from 'react';
import {useTheme} from '@emotion/react';
import {css} from '@linaria/core';

import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {theme as linariaTheme} from '@sentry/scraps/theme';

import {AiSpanStatusIcon} from 'sentry/views/insights/pages/agents/components/aiSpanStatusIcon';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

interface TranscriptSpanRowProps {
  ariaLabel: string;
  isSelected: boolean;
  /** Right-aligned metadata, e.g. a `TurnMeta`. */
  meta: ReactNode;
  onSelect: () => void;
  tag: ReactNode;
  node?: AITraceSpanNode;
  /** One-line summary after the tag, e.g. a tool call's arguments. */
  preview?: string | null;
}

/**
 * A selectable one-line transcript row for a span that isn't a message, like a
 * tool call or an evaluation: status icon, tag and a monospace preview, with
 * the metadata right-aligned. Selection shows an outline.
 */
export function TranscriptSpanRow({
  ariaLabel,
  isSelected,
  meta,
  onSelect,
  tag,
  node,
  preview,
}: TranscriptSpanRowProps) {
  const theme = useTheme();

  // Widen past the content so the outline clears the icon/duration, then pull
  // back with a negative margin to keep them message-aligned (no scraps prop
  // for negative margins or hover).

  const rowCss = css`
    width: calc(100% + ${linariaTheme.space.sm} * 2);
    margin: 0 -${linariaTheme.space.sm};
    &:hover {
      background: ${linariaTheme.tokens.interactive.transparent.neutral.background.hover};
    }
  `;

  return (
    <Container
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={ariaLabel}
      radius="sm"
      padding="sm sm"
      cursor="pointer"
      customCss={rowCss}
      data-selected={isSelected}
      style={
        isSelected
          ? {
              outline: `2px solid ${theme.tokens.focus.default}`,
              outlineOffset: '-2px',
            }
          : undefined
      }
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onSelect();
        }
      }}
    >
      <Flex align="center" justify="between" gap="md" width="100%">
        <Flex align="center" gap="sm" minWidth={0}>
          {node && <AiSpanStatusIcon node={node} />}
          {tag}
          {preview ? (
            <Text size="xs" monospace variant="muted" ellipsis>
              {preview}
            </Text>
          ) : null}
        </Flex>
        {meta}
      </Flex>
    </Container>
  );
}
