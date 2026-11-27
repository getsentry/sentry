import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useTheme} from '@emotion/react';
import {FocusScope} from '@react-aria/focus';
import {motion, useReducedMotion} from 'framer-motion';

import {Container, Stack, Surface} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {PositionWrapper} from '@sentry/scraps/overlay';
import {useOverlay} from '@sentry/scraps/useOverlay';

import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {PRIMARY_NAVIGATION_OVERLAY_OFFSET} from 'sentry/views/navigation/constants';
import {
  hasSecondaryNavigation,
  type NavigationGroup,
  usePrimaryNavigation,
} from 'sentry/views/navigation/primaryNavigationContext';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {SecondaryNavigationContent} from 'sentry/views/navigation/secondary/content';
import {useSecondaryNavigation} from 'sentry/views/navigation/secondaryNavigationContext';

import {isPrimaryNavigationLinkActive} from './components';

/** Hover delay before a closed preview opens, so passing pointers don't open it. */
const PREVIEW_OPEN_DELAY_MS = 120;
/** Grace period for the pointer to move between a primary item and its preview. */
const PREVIEW_CLOSE_DELAY_MS = 200;
/** How far the content slides in from when the preview moves to another item. */
const PREVIEW_SLIDE_DISTANCE_PX = 12;

interface PreviewState {
  group: NavigationGroup;
  /** Opened from the keyboard, so the preview takes focus and ignores the pointer. */
  keyboard: boolean;
  /** The preview closes when the location changes. */
  locationKey: string;
  /** Vertical offset the content slides in from. */
  slideFrom: number;
}

interface UsePrimaryNavigationPreviewProps {
  /** While disabled, hovering and Right Arrow do not open a preview. */
  enabled: boolean;
  /** Interactions with this element do not close the preview. */
  ignoreInteractOutsideRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Opens a preview card of a primary navigation item's secondary navigation on
 * hover, or on Right Arrow.
 *
 * Returns the props for each primary navigation item, and the preview card to
 * render.
 */
export function usePrimaryNavigationPreview({
  enabled,
  ignoreInteractOutsideRef,
}: UsePrimaryNavigationPreviewProps) {
  const reduceMotion = useReducedMotion();
  const {activeGroup, setActiveGroup} = usePrimaryNavigation();
  const {view} = useSecondaryNavigation();
  const location = useLocation();
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const previewTimer = useRef<number | undefined>(undefined);

  const canPreviewGroup = (group: NavigationGroup) =>
    enabled &&
    hasSecondaryNavigation(group) &&
    (group !== activeGroup || view !== 'expanded');
  const openPreview =
    preview?.locationKey === location.key && canPreviewGroup(preview.group)
      ? preview
      : null;
  if (preview && !openPreview) {
    setPreview(null);
  }

  const closePreview = useCallback(() => {
    window.clearTimeout(previewTimer.current);
    setPreview(null);
  }, []);
  const scheduleClose = () => {
    window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(
      () => setPreview(null),
      PREVIEW_CLOSE_DELAY_MS
    );
  };
  const cancelClose = () => window.clearTimeout(previewTimer.current);

  useEffect(() => () => window.clearTimeout(previewTimer.current), []);

  const {
    overlayProps,
    triggerProps: {ref: setPreviewAnchor},
    triggerRef: previewAnchor,
  } = useOverlay({
    isOpen: openPreview !== null,
    onOpenChange: isOpen => {
      if (!isOpen) {
        closePreview();
      }
    },
    position: 'right-start',
    offset: PRIMARY_NAVIGATION_OVERLAY_OFFSET,
    shouldApplyMinWidth: false,
    shouldCloseOnBlur: true,
    shouldCloseOnInteractOutside: target =>
      !ignoreInteractOutsideRef?.current?.contains(target),
  });

  const openPreviewFor = (
    item: HTMLAnchorElement,
    group: NavigationGroup,
    keyboard: boolean
  ) => {
    if (openPreview?.group === group && openPreview.keyboard === keyboard) {
      return;
    }

    // Anchor to the icon, which lines up with the footer buttons that the
    // other primary navigation menus open from.
    const anchor = item.querySelector<HTMLElement>('[data-icon-container]') ?? item;
    const previousAnchor = openPreview && previewAnchor.current;
    const slideFrom =
      !reduceMotion && previousAnchor && previousAnchor !== anchor
        ? previousAnchor.compareDocumentPosition(anchor) &
          Node.DOCUMENT_POSITION_FOLLOWING
          ? -PREVIEW_SLIDE_DISTANCE_PX
          : PREVIEW_SLIDE_DISTANCE_PX
        : 0;

    setPreviewAnchor(anchor);
    setPreview({group, keyboard, locationKey: location.key, slideFrom});
  };

  const handlePointerEnter = (
    event: React.PointerEvent<HTMLAnchorElement>,
    group: NavigationGroup
  ) => {
    if (event.pointerType !== 'mouse') {
      return;
    }
    if (!canPreviewGroup(group)) {
      closePreview();
      return;
    }
    cancelClose();
    const item = event.currentTarget;
    if (openPreview) {
      openPreviewFor(item, group, false);
    } else {
      previewTimer.current = window.setTimeout(
        () => openPreviewFor(item, group, false),
        PREVIEW_OPEN_DELAY_MS
      );
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLAnchorElement>,
    group: NavigationGroup
  ) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      cancelClose();
      openPreviewFor(event.currentTarget, group, true);
    }
  };

  /**
   * Props for a primary navigation item. Takes the place of the props from
   * `useActivateNavigationGroupOnHover` when hovering opens a preview.
   */
  const makePreviewProps = (
    group: NavigationGroup,
    to: string,
    activeTo?: string | string[]
  ): Omit<Partial<LinkProps>, 'to'> => {
    const activePaths = Array.isArray(activeTo) ? activeTo : [activeTo ?? to];
    const isActive = activePaths.some(path =>
      isPrimaryNavigationLinkActive(normalizeUrl(path), location.pathname)
    );
    const canPreview = canPreviewGroup(group);

    return {
      'aria-current': isActive ? ('location' as const) : undefined,
      'data-active-group': activeGroup === group ? 'true' : undefined,
      'aria-keyshortcuts': canPreview ? 'ArrowRight' : undefined,
      onPointerEnter: enabled ? event => handlePointerEnter(event, group) : undefined,
      onPointerLeave: canPreview && !openPreview?.keyboard ? scheduleClose : undefined,
      onKeyDown: canPreview ? event => handleKeyDown(event, group) : undefined,
      onClick: () => {
        closePreview();
        setActiveGroup(group);
      },
    };
  };

  const previewCard = openPreview ? (
    <PrimaryNavigationPreviewCard
      preview={openPreview}
      overlayProps={overlayProps}
      onPointerEnter={cancelClose}
      onPointerLeave={openPreview.keyboard ? undefined : scheduleClose}
      onNavigate={closePreview}
    />
  ) : null;

  return {makePreviewProps, previewCard};
}

interface PrimaryNavigationPreviewCardProps {
  onNavigate: () => void;
  onPointerEnter: () => void;
  onPointerLeave: (() => void) | undefined;
  overlayProps: React.HTMLAttributes<HTMLDivElement>;
  preview: PreviewState;
}

function PrimaryNavigationPreviewCard({
  preview,
  overlayProps,
  onPointerEnter,
  onPointerLeave,
  onNavigate,
}: PrimaryNavigationPreviewCardProps) {
  const theme = useTheme();
  // The preview body moves focus in once its sections render.
  const previewContext = useMemo(
    () => ({onNavigate, autoFocus: preview.keyboard}),
    [onNavigate, preview.keyboard]
  );

  return createPortal(
    <FocusScope
      restoreFocus={preview.keyboard}
      key={preview.keyboard ? 'keyboard' : 'pointer'}
    >
      <PositionWrapper
        {...overlayProps}
        zIndex={theme.zIndex.hovercard}
        style={{
          ...overlayProps.style,
          transition: preview.slideFrom ? `top ${theme.motion.enter.fast}` : undefined,
        }}
        role="dialog"
        aria-label={t('Navigation preview')}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <Surface variant="overlay" elevation="high">
          {surfaceProps => (
            <Stack
              {...surfaceProps}
              width="320px"
              maxWidth="inherit"
              maxHeight="inherit"
              overflow="hidden"
              position="relative"
            >
              <MotionPreviewPanel
                key={preview.group}
                minHeight="0"
                padding="md 0"
                overflowX="hidden"
                overflowY="auto"
                overscrollBehavior="contain"
                initial={preview.slideFrom ? {y: preview.slideFrom} : false}
                animate={{y: 0}}
                transition={theme.motion.framer.enter.fast}
              >
                <SecondaryNavigation.Preview value={previewContext}>
                  <SecondaryNavigationContent group={preview.group} />
                </SecondaryNavigation.Preview>
              </MotionPreviewPanel>
            </Stack>
          )}
        </Surface>
      </PositionWrapper>
    </FocusScope>,
    document.body
  );
}

const MotionPreviewPanel = motion.create(Container);
