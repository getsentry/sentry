import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {ClippedBox} from 'sentry/components/clippedBox';

// Chat detail content — a tool call's input/output, an agent's thinking trace — can be a
// one-line chip or several hundred lines of text/JSON. Capping it keeps a single verbose block
// from pushing every later message off screen, while the reveal stays one click away.
export const DETAIL_CLIP_HEIGHT = 180;

// `ClippedBox` defaults to a vertical `padding` (and a `Show More` fade sized for full-page
// content); both fight the compact chat surfaces this is used in, so they are zeroed and the
// fade swapped for a plain-text link sized to match.
const DetailClippedBox = styled(ClippedBox)`
  min-width: 0;
  max-width: 100%;
  padding: 0;
`;

function DetailClipFade({showMoreButton}: {showMoreButton: ReactNode}) {
  return (
    <Flex justify="start" paddingTop="xs">
      {showMoreButton}
    </Flex>
  );
}

/**
 * Caps chat detail content at {@link DETAIL_CLIP_HEIGHT} with a click-to-expand affordance,
 * rather than letting one verbose block (a large JSON body, a long thinking trace) push
 * everything after it off screen. A short value never shows the affordance at all —
 * `ClippedBox` only clips once the content actually exceeds the cap.
 */
export function ClippedDetail({children}: {children: ReactNode}) {
  return (
    <DetailClippedBox
      clipHeight={DETAIL_CLIP_HEIGHT}
      buttonProps={{size: 'xs', variant: 'transparent'}}
      clipFade={DetailClipFade}
    >
      {children}
    </DetailClippedBox>
  );
}
