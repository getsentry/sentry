import {useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';

import {
  BaseSplitDivider,
  SplitPanel,
  type SplitPanelProps,
} from 'sentry/components/splitPanel';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useMedia} from 'sentry/utils/useMedia';
import {SeerExplorerPanel} from 'sentry/views/seerExplorer/components/sidebar/seerExplorerPanel';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

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
 * In sidebar mode the area is constrained to the viewport (`overflow: hidden`)
 * and the content scrolls inside its own pane — this gives Seer's pane a bounded
 * height so its header/input position correctly, and lets the bottom dock render
 * within the viewport. The `SplitPanel` is rendered only once the container has
 * been measured so its initial size is computed from real dimensions.
 */
export function SeerExplorerSidebarLayout({children}: {children: React.ReactNode}) {
  const {isSidebarMode, isOpen, sidebarPosition} = useSeerExplorerContext();
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const {width, height} = useDimensions({elementRef: containerRef});
  const isWideScreen = useMedia(`(min-width: ${theme.breakpoints.xl})`);

  if (!isSidebarMode) {
    return children;
  }

  // Auto docks right on wide viewports, bottom otherwise. Media query for now;
  // a container query (on the actual content area) would be more accurate and is
  // a planned follow-up. `useDimensions` is only used to size the SplitPanel.
  const orientation =
    sidebarPosition === 'auto' ? (isWideScreen ? 'right' : 'bottom') : sidebarPosition;

  const hasSize = width > 0 && height > 0;
  const seerPanel = isOpen ? <SeerExplorerPanel /> : null;
  // Let the routed app content scroll within its own pane instead of growing the
  // split (which would push Seer's pane out of the viewport).
  const contentPane = (
    <Stack flex="1" minWidth="0" minHeight="0" overflowY="auto">
      {children}
    </Stack>
  );

  const splitProps: SplitPanelProps =
    orientation === 'right'
      ? {
          availableSize: width,
          left: {
            content: contentPane,
            default: Math.max(width - DEFAULT_SEER_WIDTH, MIN_CONTENT_WIDTH),
            min: MIN_CONTENT_WIDTH,
            max: Math.max(width - MIN_SEER_WIDTH, MIN_CONTENT_WIDTH),
          },
          right: seerPanel,
          sizeStorageKey: 'seer-explorer-sidebar-size:right',
        }
      : {
          availableSize: height,
          top: {
            content: contentPane,
            default: Math.max(height - DEFAULT_SEER_HEIGHT, MIN_CONTENT_HEIGHT),
            min: MIN_CONTENT_HEIGHT,
            max: Math.max(height - MIN_SEER_HEIGHT, MIN_CONTENT_HEIGHT),
          },
          bottom: seerPanel,
          sizeStorageKey: 'seer-explorer-sidebar-size:bottom',
        };

  // `contain="size"` decouples this element's size from its contents (like
  // `ViewportConstrainedPage`) so the flex algorithm sizes it to the remaining
  // space instead of letting the tall page content grow it — giving Seer's pane
  // a viewport-bounded height.
  return (
    <Flex
      ref={containerRef}
      flex="1"
      minWidth="0"
      minHeight="0"
      position="relative"
      contain="size"
      overflow="hidden"
    >
      {hasSize ? <SplitPanel {...splitProps} SplitDivider={SidebarSplitDivider} /> : null}
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
