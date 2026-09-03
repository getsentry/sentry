import type {ReactNode} from 'react';

import {Container} from '@sentry/scraps/layout/container';

import {ClippedBox} from 'sentry/components/clippedBox';

// Chat detail content — a tool call's input/output, an agent's thinking trace — can be a
// one-line chip or several hundred lines of text/JSON. Capping it keeps a single verbose block
// from pushing every later message off screen, while the reveal stays one click away.
const DETAIL_CLIP_HEIGHT = 180;

/**
 * Caps chat detail content at {@link DETAIL_CLIP_HEIGHT} with a click-to-expand affordance,
 * rather than letting one verbose block (a large JSON body, a long thinking trace) push
 * everything after it off screen. A short value never shows the affordance at all —
 * `ClippedBox` only clips once the content exceeds `clipHeight + clipFlex` (208 px with
 * these defaults).
 */
export function ClippedDetail({children}: {children: ReactNode}) {
  return (
    <Container minWidth="0" maxWidth="100%" padding="0">
      {containerProps => (
        <ClippedBox
          {...containerProps}
          clipHeight={DETAIL_CLIP_HEIGHT}
          buttonProps={{size: 'xs'}}
          clipFade={({showMoreButton}) => (
            <Container
              position="absolute"
              left={0}
              bottom={0}
              paddingTop="xs"
              style={{pointerEvents: 'none'}}
            >
              <div style={{pointerEvents: 'auto'}}>{showMoreButton}</div>
            </Container>
          )}
        >
          {children}
        </ClippedBox>
      )}
    </Container>
  );
}
