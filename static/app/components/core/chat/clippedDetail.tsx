import {type ReactNode, useCallback, useState} from 'react';

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
 *
 * Overflowed children are marked `inert` while clipped so keyboard users cannot
 * tab into content hidden behind `overflow: hidden`. Content is treated as
 * clipped until the (asynchronous) resize measurement proves otherwise.
 */
export function ClippedDetail({children}: {children: ReactNode}) {
  // Assume clipped until measured: between mount and the ResizeObserver callback,
  // overflowed content would otherwise be hidden but still keyboard-focusable.
  const [isClipped, setIsClipped] = useState(true);

  // The fade unmounts on reveal (or once measurement proves the content is short),
  // clearing `inert` in the same commit that removes it.
  const onClipFadeRef = useCallback(
    (node: HTMLElement | null) => setIsClipped(node !== null),
    []
  );

  return (
    <Container minWidth="0" maxWidth="100%" padding="0">
      {containerProps => (
        <ClippedBox
          {...containerProps}
          clipHeight={DETAIL_CLIP_HEIGHT}
          defaultClipped
          buttonProps={{size: 'xs'}}
          clipFade={({showMoreButton}) => (
            <Container
              ref={onClipFadeRef}
              position="absolute"
              left={0}
              bottom={0}
              paddingTop="xs"
              pointerEvents="none"
            >
              <Container pointerEvents="auto">{showMoreButton}</Container>
            </Container>
          )}
        >
          <div inert={isClipped ? true : undefined}>{children}</div>
        </ClippedBox>
      )}
    </Container>
  );
}
