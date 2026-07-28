import type {ReactNode} from 'react';
import {useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconChevron} from 'sentry/icons';

interface CollapsibleContentProps {
  /** The rendered content revealed when expanded (markdown, nested blocks, etc.). */
  children: ReactNode;
  /** Summary label next to the caret (caller-styled). */
  title: ReactNode;
  /** Start expanded. Defaults to collapsed. */
  defaultOpen?: boolean;
  /** Cap on the section width, e.g. to match a message bubble. */
  maxWidth?: string;
  /** Fires on expand/collapse with the new open state. */
  onToggle?: (open: boolean) => void;
  /** Single-line preview shown inline after the title while collapsed. */
  preview?: ReactNode;
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
  defaultOpen = false,
  onToggle,
  maxWidth,
  preview,
}: CollapsibleContentProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Details
      open={isOpen}
      style={maxWidth ? {maxWidth} : undefined}
      onToggle={e => {
        const open = e.currentTarget.open;
        setIsOpen(open);
        onToggle?.(open);
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
        <IconChevron direction={isOpen ? 'down' : 'right'} size="sm" variant="muted" />
        {preview !== undefined && !isOpen ? (
          <Flex flex="1" minWidth={0}>
            <Text ellipsis>
              {title} {preview}
            </Text>
          </Flex>
        ) : (
          title
        )}
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
