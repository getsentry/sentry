import {Flex, Stack} from '@sentry/scraps/layout';
import {SplitPanel} from '@sentry/scraps/splitPanel';

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
 * Wraps the main app content so Seer Explorer can render as a resizable split
 * panel beside it (right on wide screens, bottom otherwise) when the persistent
 * sidebar flag is on. When off, the content is returned untouched (drawer mode).
 *
 * The app content is `SplitPanel`'s `sized` pane and Seer is the optional `fill`
 * pane: when Seer is closed there's no `fill`, so `SplitPanel` collapses to the
 * app at full size with no divider. Keeping the app as the always-present pane
 * means it stays mounted across open/close — only the Seer pane toggles, so the
 * routed app never remounts.
 *
 * `SplitPanel` measures its own container, but we also measure here so the app
 * pane's initial size can be derived from Seer's persisted size (`available −
 * seerSize`). We gate the split on that measurement so the app pane opens at the
 * right size on the first paint; before then the app content renders on its own
 * (never gated away), so the routed app is always in the tree.
 *
 * The persisted size is *Seer's* (viewport-independent), keyed per orientation,
 * and is written only on a real drag via `onResizeEnd` — programmatic/measure
 * resizes don't persist, so a saved size is never clobbered.
 */
export function SeerExplorerSidebarLayout({children}: {children: React.ReactNode}) {
  const {isSidebarMode, isOpen, sidebarPosition, sidebarContainerRef} =
    useSeerExplorerContext();
  const {width, height} = useDimensions({elementRef: sidebarContainerRef});
  const orientation = useSeerExplorerSidebarOrientation(sidebarPosition);

  const isRight = orientation === 'right';
  const available = isRight ? width : height;
  const minContent = isRight ? MIN_CONTENT_WIDTH : MIN_CONTENT_HEIGHT;
  const minSeer = isRight ? MIN_SEER_WIDTH : MIN_SEER_HEIGHT;
  const defaultSeerSize = isRight ? DEFAULT_SEER_WIDTH : DEFAULT_SEER_HEIGHT;
  const seerSizeKey = SEER_EXPLORER_SIDEBAR_SEER_SIZE_KEY[orientation];

  const storedSeerSize = parseInt(localStorage.getItem(seerSizeKey) ?? '', 10);
  const seerSize = storedSeerSize > 0 ? storedSeerSize : defaultSeerSize;

  if (!isSidebarMode) {
    return children;
  }

  // Seed the app (sized) pane from the persisted Seer size; `SplitPanel` clamps
  // it to [minContent, available − minSeer], so we don't clamp here. The double
  // click reset target uses the *default* Seer size.
  const initialContentSize = available - seerSize;
  const defaultContentSize = available - defaultSeerSize;

  // Persist Seer's size from a drag (the app pane shrinks → Seer grows). Fires
  // only on drag end, never on programmatic/measure resizes, so a saved size is
  // never overwritten by a clamped one.
  const persistSeerSize = (contentEndSize: number) => {
    if (available <= 0) {
      return;
    }
    const seer = Math.max(minSeer, available - contentEndSize);
    localStorage.setItem(seerSizeKey, String(Math.round(seer)));
  };

  // Let the routed app content scroll within its own pane instead of growing the
  // split (which would push Seer's pane out of the viewport).
  const contentPane = (
    <Stack flex="1" minWidth="0" minHeight="0" overflowY="auto">
      {children}
    </Stack>
  );

  // `contain="size"` decouples this element's size from its contents (like
  // `ViewportConstrainedPage`) so the flex algorithm sizes it to the remaining
  // space instead of letting the tall page content grow it — giving Seer's pane
  // a viewport-bounded height.
  return (
    <Flex
      ref={sidebarContainerRef}
      direction="column"
      flex="1"
      minWidth="0"
      minHeight="0"
      position="relative"
      contain="size"
      overflow="hidden"
    >
      {available > 0 ? (
        <SplitPanel
          orientation={isRight ? 'horizontal' : 'vertical'}
          defaultSize={defaultContentSize}
          initialSize={initialContentSize}
          minSize={minContent}
          fillMinSize={minSeer}
          onResizeEnd={({endSize}) => persistSeerSize(endSize)}
          sized={contentPane}
          fill={isOpen ? <SeerExplorerPanel /> : undefined}
        />
      ) : (
        contentPane
      )}
    </Flex>
  );
}
