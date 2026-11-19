import type {ReactNode} from 'react';
import {useState} from 'react';
import styled from '@emotion/styled';
import {IconChevron} from '@sentry/icons/chevron';

import {Container, Flex} from '@sentry/scraps/layout';

import {TURN_META_WIDTH} from './turnMeta';

interface CollapsibleContentProps {
  /** The rendered content revealed when expanded (markdown, nested blocks, etc.). */
  children: ReactNode;
  /**
   * Summary label next to the caret (caller-styled). A function form receives the
   * open state, e.g. to show a collapsed preview only while closed.
   */
  title: ReactNode | ((isOpen: boolean) => ReactNode);
  /** Forwarded to the root `<details>`, so callers can style it with `styled()`. */
  className?: string;
  /** Start expanded when uncontrolled. Defaults to collapsed. */
  defaultOpen?: boolean;
  /** Fires on expand/collapse with the new open state. */
  onOpenChange?: (open: boolean) => void;
  /**
   * The open state, for a caller that controls it (paired with `onOpenChange`).
   * Without it the section keeps its own state, starting from `defaultOpen`.
   */
  open?: boolean;
  /**
   * Show the leading caret. Turn it off for a title that shows its own open
   * state. Defaults to shown.
   */
  showCaret?: boolean;
}

/**
 * Collapsible section shared across AI chat surfaces, for reasoning sections and
 * collapsed XML tag blocks. Built on a native `<details>` so collapsed content
 * stays in the DOM (find-in-page); summary clicks don't propagate so it can
 * live inside a clickable bubble.
 */
export function CollapsibleContent({
  children,
  title,
  className,
  defaultOpen = false,
  open,
  showCaret = true,
  onOpenChange,
}: CollapsibleContentProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = open ?? uncontrolledOpen;

  return (
    <Details
      open={isOpen}
      className={className}
      onToggle={e => {
        const nextOpen = e.currentTarget.open;
        if (nextOpen === isOpen) {
          return;
        }
        setUncontrolledOpen(nextOpen);
        onOpenChange?.(nextOpen);
      }}
    >
      <Flex
        as="summary"
        align="center"
        gap="xs"
        width="100%"
        minWidth={0}
        justify="start"
        cursor="pointer"
        onClick={e => e.stopPropagation()}
      >
        {showCaret && (
          <IconChevron direction={isOpen ? 'down' : 'right'} size="sm" variant="muted" />
        )}
        {typeof title === 'function' ? title(isOpen) : title}
      </Flex>
      {children}
    </Details>
  );
}

const Details = styled('details')`
  width: 100%;
  min-width: 0;

  summary {
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
`;

interface CollapsibleChatRowProps extends CollapsibleContentProps {
  /**
   * Right-aligned metadata, kept in a fixed-width column that lines up with the
   * transcript's tool-call rows. The column is reserved even when empty so the
   * title/preview wraps at the same width across rows.
   */
  meta?: ReactNode;
}

/**
 * A `CollapsibleContent` styled and laid out for the conversation transcript: the
 * summary gets the default hover background, matches a tool-call row's height and
 * gutter bleed, and reserves the shared metadata column on the right. Used for the
 * collapsed tool-call group and the thinking block.
 */
export function CollapsibleChatRow({
  title: titleProp,
  meta,
  ...props
}: CollapsibleChatRowProps) {
  const title = (isOpen: boolean) => (
    <Flex flex="1" minWidth={0} align="center" gap="md">
      <Flex flex="1" minWidth={0} align="center">
        {typeof titleProp === 'function' ? titleProp(isOpen) : titleProp}
      </Flex>
      <Container width={TURN_META_WIDTH} flexShrink={0}>
        {meta}
      </Container>
    </Flex>
  );

  return <StyledCollapsibleChatRow {...props} title={title} />;
}

const StyledCollapsibleChatRow = styled(CollapsibleContent)`
  & > summary {
    /* Match a tool-call row's height: its 20px tool tag plus the shared row
     * padding below, so the collapsed header lines up with the calls. */
    min-height: calc(20px + ${p => p.theme.space.sm} * 2);

    /* Widen past the content and pull back with a negative margin so the hover
     * background bleeds symmetrically into the gutter, matching the rows. */
    width: calc(100% + ${p => p.theme.space.sm} * 2);
    margin: 0 -${p => p.theme.space.sm};
    border-radius: ${p => p.theme.radius.sm};
    padding: 0 ${p => p.theme.space.sm};

    &:hover {
      background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
    }
  }
`;
