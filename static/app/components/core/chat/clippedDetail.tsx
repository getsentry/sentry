import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {ClippedBox} from 'sentry/components/clippedBox';

// Chat detail content — a tool call's input/output, an agent's thinking trace — can be a
// one-line chip or several hundred lines of text/JSON. Capping it keeps a single verbose block
// from pushing every later message off screen, while the reveal stays one click away.
const DETAIL_CLIP_HEIGHT = 180;

// `ClippedBox` defaults to a vertical `padding`; it fights the compact chat surfaces this is
// used in, so it is zeroed here.
const DetailClippedBox = styled(ClippedBox)`
  min-width: 0;
  max-width: 100%;
  padding: 0;
`;

// The default `ClipFade` fades to a hardcoded background token, which would mismatch these
// surfaces (a `background="secondary"` box, a transparent `Disclosure.Content`). Rather than
// guess at a matching fade, this stays a plain absolutely-positioned button pinned to the
// bottom-left corner — same placement as the default, no gradient.
const DetailClipFade = styled('div')`
  position: absolute;
  left: 0;
  bottom: 0;
  padding-top: ${p => p.theme.space.xs};
`;

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
      buttonProps={{size: 'xs'}}
      clipFade={({showMoreButton}) => <DetailClipFade>{showMoreButton}</DetailClipFade>}
    >
      {children}
    </DetailClippedBox>
  );
}
