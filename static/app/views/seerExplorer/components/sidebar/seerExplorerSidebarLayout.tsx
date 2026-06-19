import {useLayoutEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';

import {
  BaseSplitDivider,
  SplitPanel,
  type SplitPanelHandle,
  type SplitPanelProps,
} from 'sentry/components/splitPanel';
import {useDimensions} from 'sentry/utils/useDimensions';
import {SeerExplorerPanel} from 'sentry/views/seerExplorer/components/sidebar/seerExplorerPanel';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';
import {
  SEER_EXPLORER_SIDEBAR_SEER_SIZE_KEY,
  useSeerExplorerSidebarOrientation,
} from 'sentry/views/seerExplorer/utils';

// Minimum widths/heights so neither the app content nor Seer collapses to nothing.
const MIN_CONTENT_WIDTH = 480;
const MIN_SEER_WIDTH = 320;
const DEFAULT_SEER_WIDTH = 420;
const MIN_CONTENT_HEIGHT = 200;
const MIN_SEER_HEIGHT = 240;
const DEFAULT_SEER_HEIGHT = 360;

/**
 * Sizing for the content (app) pane of the split, given the available space and
 * Seer's persisted size. `SplitPanel` sizes the content pane and Seer takes the
 * `1fr` remainder, so these bounds also determine Seer's size.
 */
export function getSidebarContentLayout({
  available,
  seerSize,
  minContent,
  minSeer,
}: {
  available: number;
  minContent: number;
  minSeer: number;
  seerSize: number;
}): {max: number; min: number; size: number} {
  // Cap the content pane so it can never push Seer below its minimum or overflow
  // the viewport. When `available < minContent + minSeer` the viewport can't fit
  // both minimums, so Seer's minimum wins and the content pane scrolls. Clamp the
  // effective content minimum to this cap so it doesn't force the pane back up.
  const max = Math.max(0, available - minSeer);
  const min = Math.min(minContent, max);
  const size = Math.max(min, Math.min(available - seerSize, max));
  return {size, min, max};
}

/**
 * Wraps the main app content so Seer Explorer can render as a resizable split
 * panel beside it (right on wide screens, bottom otherwise) when the persistent
 * sidebar flag is on. When off, the content is returned untouched (drawer mode).
 *
 * In sidebar mode the area is constrained to the viewport (`overflow: hidden`)
 * and the content scrolls inside its own pane — this gives Seer's pane a bounded
 * height so its header/input position correctly, and lets the bottom dock render
 * within the viewport. The `SplitPanel` (and therefore the routed app) always
 * renders; only Seer's pane waits for the container to be measured, so its size
 * is computed from real dimensions while the app stays visible meanwhile.
 */
export function SeerExplorerSidebarLayout({children}: {children: React.ReactNode}) {
  const {isSidebarMode, isOpen, sidebarPosition, sidebarContainerRef} =
    useSeerExplorerContext();
  const {width, height} = useDimensions({elementRef: sidebarContainerRef});
  // Auto docks right on wide viewports, bottom otherwise. Media query for now;
  // a container query (on the actual content area) would be more accurate and is
  // a planned follow-up. `useDimensions` is only used to size the SplitPanel.
  const orientation = useSeerExplorerSidebarOrientation(sidebarPosition);

  // Seer keeps a fixed size and the content area flexes with the viewport.
  // `SplitPanel` sizes its first (content) pane, so we size it as
  // `available - seerSize` and persist *Seer's* size ourselves (which is
  // viewport-independent); Seer is the `1fr` remainder.
  const isRight = orientation === 'right';
  const available = isRight ? width : height;
  const minContent = isRight ? MIN_CONTENT_WIDTH : MIN_CONTENT_HEIGHT;
  const minSeer = isRight ? MIN_SEER_WIDTH : MIN_SEER_HEIGHT;
  const defaultSeerSize = isRight ? DEFAULT_SEER_WIDTH : DEFAULT_SEER_HEIGHT;
  const seerSizeKey = SEER_EXPLORER_SIDEBAR_SEER_SIZE_KEY[orientation];

  const storedSeerSize = parseInt(localStorage.getItem(seerSizeKey) ?? '', 10);
  const seerSize = storedSeerSize > 0 ? storedSeerSize : defaultSeerSize;
  const {
    size: contentSize,
    min: contentMin,
    max: contentMax,
  } = getSidebarContentLayout({available, seerSize, minContent, minSeer});

  // The SplitPanel stays mounted across open/close (so the app never remounts)
  // and only reads its size on mount. Push the recomputed content size whenever
  // Seer (re)opens, the orientation changes, or the viewport resizes — so Seer
  // stays a fixed size and the content area absorbs viewport changes (and a size
  // written while closed — e.g. by resizing the popped-out window — is adopted).
  const splitPanelRef = useRef<SplitPanelHandle>(null);
  useLayoutEffect(() => {
    if (!isSidebarMode || !isOpen || available <= 0) {
      return;
    }
    splitPanelRef.current?.setSize(contentSize);
  }, [isSidebarMode, isOpen, available, orientation, contentSize]);

  if (!isSidebarMode) {
    return children;
  }

  // Gate only the Seer pane on measurement (not the content): the routed app
  // must always be in the tree. Before the container is measured the second
  // pane is null, so the SplitPanel collapses to content-at-100%.
  const hasSize = width > 0 && height > 0;

  const seerPanel = isOpen && hasSize ? <SeerExplorerPanel /> : null;
  // Let the routed app content scroll within its own pane instead of growing the
  // split (which would push Seer's pane out of the viewport).
  const contentPane = (
    <Stack flex="1" minWidth="0" minHeight="0" overflowY="auto">
      {children}
    </Stack>
  );

  // Persist Seer's size from a divider drag (content shrinks → Seer grows).
  // Ignore pre-measure callbacks (the mount-time `onResize` fires before the
  // container is measured) so we don't persist a size derived from a 0 width.
  const onContentResize = (contentPx: number) => {
    if (available <= 0) {
      return;
    }
    const seer = Math.max(
      minSeer,
      Math.min(available - contentPx, available - minContent)
    );
    localStorage.setItem(seerSizeKey, String(Math.round(seer)));
  };

  const side = {
    content: contentPane,
    default: contentSize,
    min: contentMin,
    max: contentMax,
  };

  const splitProps: SplitPanelProps = isRight
    ? {availableSize: available, left: side, right: seerPanel, onResize: onContentResize}
    : {availableSize: available, top: side, bottom: seerPanel, onResize: onContentResize};

  // `contain="size"` decouples this element's size from its contents (like
  // `ViewportConstrainedPage`) so the flex algorithm sizes it to the remaining
  // space instead of letting the tall page content grow it — giving Seer's pane
  // a viewport-bounded height.
  return (
    <Flex
      ref={sidebarContainerRef}
      flex="1"
      minWidth="0"
      minHeight="0"
      position="relative"
      contain="size"
      overflow="hidden"
    >
      <SplitPanel
        ref={splitPanelRef}
        {...splitProps}
        SplitDivider={SidebarSplitDivider}
      />
    </Flex>
  );
}

const SidebarSplitDivider = styled(BaseSplitDivider)`
  &[data-slide-direction='leftright'] {
    border-right: 1px solid ${p => p.theme.tokens.border.primary};
  }
  &[data-slide-direction='updown'] {
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;
