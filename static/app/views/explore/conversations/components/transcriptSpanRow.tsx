import type {ReactNode} from 'react';
import {css, useTheme} from '@emotion/react';

import {Flex} from '@sentry/scraps/layout';

import {
  AiSpanIssueLink,
  AiSpanLabel,
  AiSpanRowButton,
  aiSpanRowStateCss,
} from 'sentry/views/insights/pages/agents/components/aiSpanRow';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

interface TranscriptSpanRowProps {
  ariaLabel: string;
  hasError: boolean;
  isSelected: boolean;
  /** Right-aligned metadata, e.g. a `TurnMeta`. */
  meta: ReactNode;
  onSelect: () => void;
  /** The span's name, e.g. a tool's or an evaluator's. */
  title: string;
  node?: AITraceSpanNode;
  /** One-line summary after the name, e.g. a tool call's arguments. */
  preview?: string | null;
}

/**
 * A selectable one-line transcript row for a span that isn't a message, like a
 * tool call or an evaluation, laid out like an Agent Timeline row: icon, bold
 * name and a monospace preview, then the issue the span raised and the
 * right-aligned metadata.
 */
export function TranscriptSpanRow({
  ariaLabel,
  hasError,
  isSelected,
  meta,
  onSelect,
  title,
  node,
  preview,
}: TranscriptSpanRowProps) {
  const theme = useTheme();

  // Widen past the content so the background clears the icon/duration, then pull
  // back with a negative margin to keep them message-aligned (no scraps prop
  // for negative margins).
  const rowCss = css`
    ${aiSpanRowStateCss(theme)};
    width: calc(100% + ${theme.space.sm} * 2);
    margin: 0 -${theme.space.sm};
  `;

  return (
    <Flex
      align="center"
      gap="md"
      padding="sm"
      css={rowCss}
      data-selected={isSelected}
      data-node-id={node?.id}
    >
      <AiSpanRowButton
        type="button"
        aria-pressed={isSelected}
        aria-label={ariaLabel}
        onClick={e => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <AiSpanLabel
          node={node}
          title={title}
          preview={preview}
          hasError={hasError}
          iconVariant="plain"
          previewGap="md"
        />
      </AiSpanRowButton>
      {node ? <AiSpanIssueLink node={node} /> : null}
      {meta}
    </Flex>
  );
}
