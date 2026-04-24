import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {PopperProps} from 'react-popper';
import {usePopper} from 'react-popper';
import {useTheme} from '@emotion/react';
import {mergeProps, mergeRefs} from '@react-aria/utils';

import {NODE_ENV} from 'sentry/constants';
import type {Theme} from 'sentry/utils/theme';

function makeDefaultPopperModifiers(arrowElement: HTMLElement | null, offset: number) {
  return [
    {
      name: 'hide',
      enabled: false,
    },
    {
      name: 'computeStyles',
      options: {
        // Using the `transform` attribute causes our borders to get blurry
        // in chrome. See [0]. This just causes it to use `top` / `left`
        // positions, which should be fine.
        //
        // [0]: https://stackoverflow.com/questions/29543142/css3-transformation-blurry-borders
        gpuAcceleration: false,
      },
    },
    {
      name: 'arrow',
      options: {
        element: arrowElement,
        // Set padding to avoid the arrow reaching the side of the tooltip
        // and overflowing out of the rounded border
        padding: 4,
      },
    },
    {
      name: 'offset',
      options: {
        offset: [0, offset],
      },
    },
    {
      name: 'preventOverflow',
      enabled: true,
      options: {
        padding: 12,
        altAxis: true,
      },
    },
  ];
}

/**
 * How long to wait before opening the overlay.
 */
const OPEN_DELAY = 400;

/**
 * How long to wait before closing the overlay when isHoverable or
 * displayTimeout is set.
 */
const CLOSE_DELAY = 150;

/**
 * While one overlay is open (or was recently open), newly-hovered overlays
 * skip the open delay so the user can scan a row of triggers without paying
 * the warmup each time. The cooldown starts when the last open overlay
 * closes; if no other overlay opens within this window, the group goes cold.
 */
const SKIP_DELAY_WINDOW = 600;

// A delay group tracks whether any overlay inside it is currently (or was
// recently) open. Reading/writing these fields at hover events is intentional
// — we don't need (and don't want) React re-renders driven by this state;
// consumers only read it at the moment of a HOVER transition. Open-listeners
// exist so siblings can snap-close mid-exit-animation when another overlay
// takes over.
interface DelayGroup {
  coolDownTimer: number | undefined;
  isWarm: boolean;
  openListeners: Set<() => void>;
}

function createDelayGroup(): DelayGroup {
  return {isWarm: false, coolDownTimer: undefined, openListeners: new Set()};
}

// Default group used when no <HoverOverlayGroupProvider> is present. In
// production the whole app shares this group — which is what we want, since
// tooltip delay semantics are naturally global.
const defaultDelayGroup = createDelayGroup();

const DelayGroupContext = createContext<DelayGroup>(defaultDelayGroup);

/**
 * Scopes a delay group to a React subtree. Overlays inside the provider share
 * warmth and snap-close coordination only with each other. Intended for tests
 * (each `render()` gets a fresh group automatically) and any future scenario
 * that needs isolated groups (e.g. a fullscreen modal).
 */
export function HoverOverlayGroupProvider({children}: {children: React.ReactNode}) {
  const [group] = useState(createDelayGroup);
  useEffect(() => {
    return () => {
      if (group.coolDownTimer !== undefined) {
        window.clearTimeout(group.coolDownTimer);
      }
    };
  }, [group]);
  return (
    <DelayGroupContext.Provider value={group}>{children}</DelayGroupContext.Provider>
  );
}

function warmUpGroup(group: DelayGroup) {
  if (group.coolDownTimer !== undefined) {
    window.clearTimeout(group.coolDownTimer);
    group.coolDownTimer = undefined;
  }
  group.isWarm = true;
  for (const listener of group.openListeners) {
    listener();
  }
}

function startGroupCoolDown(group: DelayGroup) {
  // In test mode the open path bypasses the warm-up delay entirely, so a
  // cooldown timer would only serve to leak onto the default group (which has
  // no provider cleaning it up). Match the open-path bypass and no-op here.
  if (NODE_ENV === 'test') {
    group.isWarm = false;
    return;
  }
  if (group.coolDownTimer !== undefined) {
    window.clearTimeout(group.coolDownTimer);
  }
  group.coolDownTimer = window.setTimeout(() => {
    group.isWarm = false;
    group.coolDownTimer = undefined;
  }, SKIP_DELAY_WINDOW);
}

type OverlayStatus = 'idle' | 'warming' | 'open' | 'cooling';

interface UseHoverOverlayProps {
  /**
   * className for when a wrapper is used. Does nothing using skipWrapper.
   */
  className?: string;
  /**
   * Display mode for the container element. Does nothing using skipWrapper.
   */
  containerDisplayMode?: React.CSSProperties['display'];
  /**
   * Time to wait (in milliseconds) before showing the overlay
   */
  delay?: number;
  /**
   * Time in ms until overlay is hidden. When used with isHoverable this is
   * used as the time allowed for the user to move their cursor into the overlay)
   */
  displayTimeout?: number;
  /**
   * Force the overlay to be visible without hovering
   */
  forceVisible?: boolean;
  /**
   * If true, user is able to hover overlay without it disappearing. (nice if
   * you want the overlay to be interactive)
   */
  isHoverable?: boolean;
  /**
   * Offset along the main axis.
   */
  offset?: number;
  /**
   * Callback whenever the hovercard is blurred
   * See also `onHover`
   */
  onBlur?: () => void;

  /**
   * Callback whenever the hovercard is hovered
   * See also `onBlur`
   */
  onHover?: () => void;

  /**
   * Position for the overlay.
   */
  position?: PopperProps<any>['placement'];

  /**
   * Only display the overlay only if the content overflows
   */
  showOnlyOnOverflow?: boolean;
  /**
   * Whether to add a dotted underline to the trigger element, to indicate the
   * presence of a overlay.
   */
  showUnderline?: boolean;
  /**
   * If child node supports ref forwarding, you can skip apply a wrapper
   */
  skipWrapper?: boolean;
  /**
   * style for when a wrapper is used. Does nothing using skipWrapper.
   */
  style?: React.CSSProperties;

  /**
   * Color of the dotted underline, if available. See also: showUnderline.
   */
  underlineColor?: 'warning' | 'danger' | 'success' | 'muted';
}

export function isOverflown(el: Element): boolean {
  // Safari seems to calculate scrollWidth incorrectly, causing isOverflown to always return true in some cases.
  // Adding a 2 pixel tolerance seems to account for this discrepancy.
  const tolerance =
    navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')
      ? 2
      : 0;
  return (
    el.scrollWidth - el.clientWidth > tolerance ||
    Array.from(el.children).some(isOverflown)
  );
}

function maybeClearRefTimeout(ref: React.MutableRefObject<number | undefined>) {
  if (typeof ref.current === 'number') {
    window.clearTimeout(ref.current);
    ref.current = undefined;
  }
}

const tooltipUnderline = (
  theme: Theme,
  underlineColor: 'warning' | 'danger' | 'success' | 'muted' = 'muted'
) =>
  ({
    textDecoration: 'underline',
    textDecorationThickness: '0.75px',
    textUnderlineOffset: '1.25px',
    textDecorationColor:
      underlineColor === 'warning'
        ? theme.tokens.content.warning
        : underlineColor === 'danger'
          ? theme.tokens.content.danger
          : underlineColor === 'success'
            ? theme.tokens.content.success
            : underlineColor === 'muted'
              ? theme.tokens.content.secondary
              : undefined,
    textDecorationStyle: 'dotted',
  }) as const;

/**
 * A hook used to trigger a positioned overlay on hover.
 */
function useHoverOverlay({
  className,
  style,
  delay,
  displayTimeout,
  isHoverable,
  showUnderline,
  underlineColor,
  showOnlyOnOverflow,
  skipWrapper,
  forceVisible,
  offset = 8,
  position = 'top',
  containerDisplayMode = 'inline-block',
  onHover,
  onBlur,
}: UseHoverOverlayProps) {
  const theme = useTheme();
  const describeById = useId();
  const group = useContext(DelayGroupContext);

  const [status, setStatus] = useState<OverlayStatus>('idle');
  const statusRef = useRef<OverlayStatus>('idle');
  // When another overlay in the group opens while we are closing (or already
  // closed-but-still-animating-out), we snap-close rather than letting the
  // exit animation trail alongside the incoming overlay.
  const [snapClosed, setSnapClosed] = useState(false);
  // Tracks whether this overlay may currently be on-screen or mid-exit-
  // animation. Used to skip snap-close bookkeeping for idle overlays that
  // have never been hovered — in pages with many siblings (tables of
  // tooltips) this keeps warmUpGroup O(visible) instead of O(N).
  const mayBeAnimatingOutRef = useRef(false);
  const commitStatus = useCallback((next: OverlayStatus) => {
    statusRef.current = next;
    setStatus(next);
    if (next === 'open' || next === 'warming') {
      setSnapClosed(false);
    }
    if (next === 'open') {
      mayBeAnimatingOutRef.current = true;
    }
  }, []);

  // Subscribe to group-open events. Only overlays that are currently visible
  // or mid-exit-animation need to snap shut — idle overlays that have never
  // opened have nothing to unmount. When snapping a 'cooling' overlay, also
  // cancel its pending hide timer so the delayed startGroupCoolDown doesn't
  // fire against the newly-warm group.
  //
  // forceVisible tooltips are explicitly decoupled from hover state — e.g.
  // form-field validation errors anchored to a warning icon. They must not
  // be snap-closed when another overlay in the group opens.
  useEffect(() => {
    if (forceVisible) {
      return;
    }
    const listener = () => {
      if (statusRef.current === 'open' || statusRef.current === 'warming') {
        return;
      }
      if (!mayBeAnimatingOutRef.current) {
        return;
      }
      if (statusRef.current === 'cooling') {
        maybeClearRefTimeout(hideTimerRef);
        commitStatus('idle');
      }
      mayBeAnimatingOutRef.current = false;
      setSnapClosed(true);
    };
    group.openListeners.add(listener);
    return () => {
      group.openListeners.delete(listener);
    };
  }, [group, forceVisible, commitStatus]);

  const isOpen = forceVisible ?? (status === 'open' || status === 'cooling');

  // Fire onHover / onBlur on open/close transitions only. Read the callbacks
  // from refs so that a new callback identity on re-render does not retrigger
  // the effect (bug: previously re-fired the current-state branch whenever an
  // inline callback was passed), and skip the initial render so onBlur does
  // not fire spuriously on mount.
  const onHoverRef = useRef(onHover);
  const onBlurRef = useRef(onBlur);
  useLayoutEffect(() => {
    onHoverRef.current = onHover;
    onBlurRef.current = onBlur;
  });
  const prevIsOpenRef = useRef(isOpen);
  useEffect(() => {
    if (prevIsOpenRef.current === isOpen) {
      return;
    }
    prevIsOpenRef.current = isOpen;
    if (isOpen) {
      onHoverRef.current?.();
    } else {
      onBlurRef.current?.();
    }
  }, [isOpen]);

  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);
  const [overlayElement, setOverlayElement] = useState<HTMLElement | null>(null);
  const [arrowElement, setArrowElement] = useState<HTMLElement | null>(null);

  const modifiers = useMemo(
    () => makeDefaultPopperModifiers(arrowElement, offset),
    [arrowElement, offset]
  );

  const {styles, state, update} = usePopper(triggerElement, overlayElement, {
    modifiers,
    placement: position,
  });

  const openTimerRef = useRef<number | undefined>(undefined);
  const hideTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      maybeClearRefTimeout(openTimerRef);
      maybeClearRefTimeout(hideTimerRef);
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (showOnlyOnOverflow && triggerElement && !isOverflown(triggerElement)) {
      return;
    }

    maybeClearRefTimeout(openTimerRef);
    maybeClearRefTimeout(hideTimerRef);

    // Re-entering an already-visible trigger (e.g. during the cooling grace
    // window, or a nested hover target): keep it open.
    if (statusRef.current === 'open' || statusRef.current === 'cooling') {
      commitStatus('open');
      warmUpGroup(group);
      return;
    }

    // Skip the warmup delay if the caller asked for instant open, we're in a
    // test environment, or the delay-group is already warm from a recently
    // open overlay.
    if (delay === 0 || NODE_ENV === 'test' || group.isWarm) {
      commitStatus('open');
      warmUpGroup(group);
      return;
    }

    commitStatus('warming');
    openTimerRef.current = window.setTimeout(() => {
      commitStatus('open');
      warmUpGroup(group);
    }, delay ?? OPEN_DELAY);
  }, [delay, showOnlyOnOverflow, triggerElement, commitStatus, group]);

  const handleMouseLeave = useCallback(() => {
    maybeClearRefTimeout(openTimerRef);
    maybeClearRefTimeout(hideTimerRef);

    // If we never made it to 'open' (still warming or already idle), cancel
    // the pending open — no cooldown starts because the group was never warmed
    // by this instance.
    if (statusRef.current !== 'open' && statusRef.current !== 'cooling') {
      commitStatus('idle');
      return;
    }

    // Note: the NODE_ENV === 'test' bypass is intentionally only applied on
    // the open path. Tests that want to verify close-delay behavior (the
    // `cooling` grace window) can do so by asserting isOpen mid-timeout,
    // which requires the timer to actually run.
    const hasCloseDelay = isHoverable || displayTimeout !== undefined;
    if (!hasCloseDelay) {
      commitStatus('idle');
      startGroupCoolDown(group);
      return;
    }

    commitStatus('cooling');
    hideTimerRef.current = window.setTimeout(() => {
      commitStatus('idle');
      startGroupCoolDown(group);
    }, displayTimeout ?? CLOSE_DELAY);
  }, [isHoverable, displayTimeout, commitStatus, group]);

  /**
   * Wraps the passed in react elements with a container that has the proper
   * event handlers to trigger the overlay.
   *
   * If skipWrapper is used the passed element will be cloned and the events
   * will be assigned to that element.
   */
  const wrapTrigger = useCallback(
    (triggerChildren: React.ReactNode) => {
      const providedProps = {
        // !!These props are always overriden!!
        'aria-describedby': describeById,
        ref: setTriggerElement,
        // The following props are composed from the componentProps trigger props
        onFocus: handleMouseEnter,
        onBlur: handleMouseLeave,
        onPointerEnter: handleMouseEnter,
        onPointerLeave: handleMouseLeave,
      };

      // Use the `type` property of the react instance to detect whether we have
      // a basic element (type=string) or a class/function component
      // (type=function or object). Because we can't rely on the child element
      // implementing forwardRefs we wrap it with a span tag for the ref
      if (
        isValidElement(triggerChildren) &&
        (skipWrapper || typeof triggerChildren.type === 'string')
      ) {
        if (showUnderline) {
          const triggerStyle = {
            ...(triggerChildren.props as any).style,
            ...tooltipUnderline(theme, underlineColor),
          };

          return cloneElement<any>(
            triggerChildren,
            Object.assign(mergeProps(triggerChildren.props as any, providedProps), {
              ref: mergeRefs((triggerChildren.props as any).ref, setTriggerElement),
              style: triggerStyle,
            })
          );
        }

        // Basic DOM nodes can be cloned and have more props applied.
        return cloneElement<any>(
          triggerChildren,
          Object.assign(mergeProps(triggerChildren.props as any, providedProps), {
            ref: mergeRefs((triggerChildren.props as any).ref, setTriggerElement),
            style: (triggerChildren.props as any).style,
          })
        );
      }

      const containerProps = Object.assign(providedProps, {
        style: {
          ...(showUnderline ? tooltipUnderline(theme, underlineColor) : {}),
          ...(containerDisplayMode ? {display: containerDisplayMode} : {}),
          maxWidth: '100%',
          ...style,
        },
        className,
      });

      // Using an inline-block solves the container being smaller
      // than the elements it is wrapping
      return <span {...containerProps}>{triggerChildren}</span>;
    },
    [
      className,
      containerDisplayMode,
      handleMouseEnter,
      handleMouseLeave,
      showUnderline,
      skipWrapper,
      describeById,
      style,
      theme,
      underlineColor,
    ]
  );

  const reset = useCallback(() => {
    maybeClearRefTimeout(openTimerRef);
    maybeClearRefTimeout(hideTimerRef);
    const wasVisible = statusRef.current === 'open' || statusRef.current === 'cooling';
    commitStatus('idle');
    if (wasVisible) {
      startGroupCoolDown(group);
    }
  }, [commitStatus, group]);

  const overlayProps = useMemo(() => {
    return {
      id: describeById,
      ref: setOverlayElement,
      style: styles.popper,
      onMouseEnter: isHoverable ? handleMouseEnter : undefined,
      onMouseLeave: isHoverable ? handleMouseLeave : undefined,
    };
  }, [
    describeById,
    setOverlayElement,
    styles.popper,
    isHoverable,
    handleMouseEnter,
    handleMouseLeave,
  ]);

  const arrowProps = useMemo(() => {
    return {
      ref: setArrowElement,
      style: styles.arrow,
      placement: state?.placement,
    };
  }, [setArrowElement, styles.arrow, state?.placement]);

  return {
    wrapTrigger,
    isOpen,
    // True when another overlay took over while this one was closing —
    // consumers should render null (bypassing any exit animation) so the
    // incoming overlay doesn't trail alongside a fading-out sibling.
    snapClosed,
    overlayProps,
    arrowProps,
    placement: state?.placement,
    arrowData: state?.modifiersData?.arrow,
    update,
    reset,
  };
}

export type {UseHoverOverlayProps};
export {useHoverOverlay};
