import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {SplitPanel, type SplitPanelHandle} from '@sentry/scraps/splitPanel';

import {useDimensions} from 'sentry/utils/useDimensions';
import {SeerExplorerPanel} from 'sentry/views/seerExplorer/components/sidebar/seerExplorerPanel';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';
import {
  SEER_EXPLORER_SIDEBAR_SEER_SIZE_KEY,
  useIsSeerExplorerSidebarEnabled,
  useSeerExplorerSidebarOrientation,
} from 'sentry/views/seerExplorer/utils';

// Minimum widths/heights so neither the app content nor Seer collapses to nothing.
const MIN_CONTENT_WIDTH = 480;
const MIN_SEER_WIDTH = 320;
const DEFAULT_SEER_WIDTH = 420;
const MIN_CONTENT_HEIGHT = 200;
const MIN_SEER_HEIGHT = 240;
const DEFAULT_SEER_HEIGHT = 360;

export function SeerExplorerSidebarLayout({children}: {children: React.ReactNode}) {
  const isSidebarMode = useIsSeerExplorerSidebarEnabled();

  return isSidebarMode ? (
    <SeerExplorerSidebarLayoutInSidebarMode>
      {children}
    </SeerExplorerSidebarLayoutInSidebarMode>
  ) : (
    children
  );
}

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
 * `SplitPanel` is always rendered (never swapped in/out on measurement) so the
 * app pane keeps its place in the tree and the routed app never remounts. We
 * measure here too, to derive the app pane's size from Seer's persisted size
 * (`available − seerSize`), and push it into the panel imperatively via
 * `ref.setSize` once measured and on viewport resize — so Seer keeps a fixed
 * size while the app flexes.
 *
 * The persisted size is *Seer's* (viewport-independent), keyed per orientation,
 * and is written only on a real drag via `onResizeEnd` — programmatic/measure
 * resizes don't persist, so a saved size is never clobbered.
 */
function SeerExplorerSidebarLayoutInSidebarMode({children}: {children: React.ReactNode}) {
  const {isOpen, sidebarPosition, sidebarContainerRef} = useSeerExplorerContext();
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

  // The app (sized) pane size = available − Seer's size, floored at `minContent`
  // (so a persisted Seer size larger than the viewport can't make it negative).
  // The double-click reset target uses the *default* Seer size.
  const contentSize = Math.max(minContent, available - seerSize);
  const defaultContentSize = Math.max(minContent, available - defaultSeerSize);

  // Seed the panel's size via a callback ref rather than gating the whole panel
  // on measurement (which would remount the routed app when dimensions arrive).
  // `contentSize` flows from the measurement, so it gives the ref a new identity
  // on first measure / resize / orientation change — React re-attaches and
  // re-applies the size.
  const seedSplitPanelSize = useCallback(
    (handle: SplitPanelHandle | null) => {
      handle?.setSize(contentSize);
    },
    [contentSize]
  );

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
    <ContentPane flex="1" minWidth="0" minHeight="0" overflowY="auto">
      {children}
    </ContentPane>
  );

  // `contain="size"` decouples this element's size from its contents (like
  // `ViewportConstrainedPage`) so the flex algorithm sizes it to the remaining
  // space instead of letting the tall page content grow it — giving Seer's pane
  // a viewport-bounded height.
  return (
    <Stack
      ref={sidebarContainerRef}
      flex="1"
      minWidth="0"
      minHeight="0"
      position="relative"
      contain="size"
      overflow="hidden"
    >
      <SplitPanel
        ref={seedSplitPanelSize}
        orientation={isRight ? 'horizontal' : 'vertical'}
        defaultSize={defaultContentSize}
        initialSize={contentSize}
        minSize={minContent}
        fillMinSize={minSeer}
        onResizeEnd={({endSize}) => persistSeerSize(endSize)}
        sized={contentPane}
        fill={isOpen ? <SeerExplorerPanel /> : undefined}
      />
    </Stack>
  );
}

// Match `html`'s scrollbar (the `*` default uses a transparent track) so the
// content pane's scrollbar looks identical to the document scrollbar.
const ContentPane = styled(Stack)`
  scrollbar-color: ${p =>
    // eslint-disable-next-line @sentry/scraps/use-semantic-token
    `${p.theme.tokens.graphics.neutral.moderate} ${p.theme.tokens.background.secondary}`};
`;
