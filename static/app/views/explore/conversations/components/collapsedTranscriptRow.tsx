import styled from '@emotion/styled';

import {CollapsibleContent} from 'sentry/components/ai/chat/collapsibleContent';

/**
 * A `CollapsibleContent` styled for the conversation transcript: the summary
 * gets the default hover background and matches the tool-call rows' padding,
 * radius, and full-width gutter bleed, so a collapsed tool-call group or
 * thinking block reads as one hoverable row alongside the calls below it.
 *
 * Split from the generic `CollapsibleContent` (still used by the trace drawer)
 * so the transcript's styling — and eventually its structure — can diverge
 * freely without touching the shared primitive.
 */
export const CollapsedTranscriptRow = styled(CollapsibleContent)`
  & > summary {
    /* Widen past the content and pull back with a negative margin so the hover
     * background bleeds symmetrically into the gutter, matching the rows. */
    width: calc(100% + ${p => p.theme.space.sm} * 2);
    margin: 0 -${p => p.theme.space.sm};
    padding: ${p => p.theme.space.sm};
    border-radius: ${p => p.theme.radius.sm};

    &:hover {
      background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
    }
  }
`;
