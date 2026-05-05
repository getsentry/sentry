import {useCallback, useEffectEvent, useLayoutEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
// eslint-disable-next-line no-restricted-imports
import color from 'color';
import {useReducedMotion} from 'framer-motion';

import type {ButtonProps} from '@sentry/scraps/button';
import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';

// Content may have margins which can't be measured by our refs, but will affect
// the total content height. We add this to the max-height to ensure the animation
// doesn't cut off early.
const HEIGHT_ADJUSTMENT_FOR_CONTENT_MARGIN = 20;

function isClipped(args: {clipFlex: number; clipHeight: number; height: number}) {
  return args.height > args.clipHeight + args.clipFlex;
}

function supportsResizeObserver(
  observerOrUndefined: unknown
): observerOrUndefined is ResizeObserver {
  return observerOrUndefined !== undefined;
}

/**
 * The Wrapper component contains padding by default, which may be modified by consumers.
 * Without adding this padding to the max-height of the child content, the reveal
 * animation will be cut short.
 */
function calculateAddedHeight({
  wrapperRef,
}: {
  wrapperRef: React.RefObject<HTMLElement | null>;
}): number {
  if (wrapperRef.current === null) {
    return 0;
  }

  try {
    const {paddingTop, paddingBottom} = getComputedStyle(wrapperRef.current);

    const addedHeight =
      parseInt(paddingTop, 10) +
      parseInt(paddingBottom, 10) +
      HEIGHT_ADJUSTMENT_FOR_CONTENT_MARGIN;

    return isNaN(addedHeight) ? 0 : addedHeight;
  } catch {
    return 0;
  }
}

function clearMaxHeight(element: HTMLElement | null) {
  if (element) {
    element.style.maxHeight = 'none';
  }
}

function disconnectObserver(observerRef: React.RefObject<ResizeObserver | null>) {
  if (observerRef.current) {
    observerRef.current.disconnect();
    observerRef.current = null;
  }
}

const DEFAULT_BUTTON_TEXT = t('Show More');
const DEFAULT_COLLAPSE_BUTTON_TEXT = t('Show Less');
interface ClippedBoxProps {
  btnText?: string;
  /**
   * Used to customize the button
   */
  buttonProps?: Partial<ButtonProps>;
  children?: React.ReactNode;
  className?: string;
  /**
   * When available replaces the default clipFade component
   */
  clipFade?: ({showMoreButton}: {showMoreButton: React.ReactNode}) => React.ReactNode;
  clipFlex?: number;
  clipHeight?: number;
  /**
   * Text for the collapse button when collapsible is true
   */
  collapseBtnText?: string;
  /**
   * When true, shows a "Show Less" button after expanding to allow collapsing back
   */
  collapsible?: boolean;
  defaultClipped?: boolean;
  /**
   * Triggered when user clicks on the show more button
   */
  onReveal?: () => void;
  /**
   * Its trigged when the component is mounted and its height available
   */
  onSetRenderedHeight?: (renderedHeight: number) => void;
  renderedHeight?: number;
  title?: string;
}

export function ClippedBox(props: ClippedBoxProps) {
  const revealTransitionPendingRef = useRef(false);
  const hasMeasuredRef = useRef(false);
  const mountedRef = useRef(false);

  const observerRef = useRef<ResizeObserver | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const prefersReducedMotion = useReducedMotion();

  const [clipped, setClipped] = useState(!!props.defaultClipped);
  const [revealed, setRevealed] = useState(false);

  const clipHeight = props.clipHeight || 200;
  const clipFlex = props.clipFlex || 28;

  const handleRenderedHeight = useEffectEvent((height: number) => {
    props.onSetRenderedHeight?.(height);
  });

  const handleReveal = (event: React.MouseEvent<HTMLElement>) => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;

    if (!wrapper) {
      throw new Error('Cannot reveal clipped box without a wrapper ref');
    }

    event.stopPropagation();

    const revealedWrapperHeight =
      (content?.clientHeight || 9999) + calculateAddedHeight({wrapperRef});

    // Only animate if the revealed height is greater than the clip height
    if (revealedWrapperHeight > clipHeight && !prefersReducedMotion) {
      revealTransitionPendingRef.current = true;
      wrapper.style.maxHeight = `${revealedWrapperHeight}px`;
    } else {
      revealTransitionPendingRef.current = false;
      clearMaxHeight(wrapper);
    }

    disconnectObserver(observerRef);

    props.onReveal?.();
    setRevealed(true);
    setClipped(false);
  };

  const handleCollapse = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();

    if (wrapperRef.current && contentRef.current) {
      if (prefersReducedMotion) {
        wrapperRef.current.style.maxHeight = `${clipHeight}px`;
      } else {
        const currentHeight =
          contentRef.current.clientHeight + calculateAddedHeight({wrapperRef});
        wrapperRef.current.style.maxHeight = `${currentHeight}px`;
        void wrapperRef.current.offsetHeight;
        wrapperRef.current.style.maxHeight = `${clipHeight}px`;
      }
    }
    revealTransitionPendingRef.current = false;
    setRevealed(false);
    setClipped(true);
  };

  const onWrapperRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      return;
    }

    wrapperRef.current = node;

    return () => {
      if (wrapperRef.current === node) {
        wrapperRef.current = null;
      }
    };
  }, []);

  const onContentRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      return;
    }

    contentRef.current = node;

    return () => {
      if (contentRef.current === node) {
        contentRef.current = null;
      }
    };
  }, []);

  const handleTransitionEnd = useCallback(
    (event: React.TransitionEvent) => {
      // This can fire for children transitions, so we need to make sure it's the
      // reveal animation that has ended.
      if (
        event.target === event.currentTarget &&
        event.propertyName === 'max-height' &&
        revealed &&
        !clipped
      ) {
        revealTransitionPendingRef.current = false;
        clearMaxHeight(event.currentTarget as HTMLElement);
      }
    },
    [clipped, revealed]
  );

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;

    if (!wrapper) {
      return;
    }

    // Activity can reattach refs while preserving state; keep the inline height
    // reconciled with the preserved clipped/revealed state.
    if (revealed || (!clipped && hasMeasuredRef.current)) {
      if (!revealTransitionPendingRef.current) {
        clearMaxHeight(wrapper);
      }
      return;
    }

    wrapper.style.maxHeight = `${clipHeight}px`;

    if (!content) {
      return;
    }

    const onResize = (entries: ResizeObserverEntry[]): void => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      const contentBox = entry.contentBoxSize?.[0];
      const borderBox = entry.borderBoxSize?.[0];
      const height = contentBox?.blockSize ?? borderBox?.blockSize ?? 0;

      if (height === 0) {
        return;
      }

      hasMeasuredRef.current = true;

      if (!mountedRef.current) {
        handleRenderedHeight(height);
        mountedRef.current = true;
      }

      const _clipped = isClipped({
        clipFlex,
        clipHeight,
        height,
      });

      if (!_clipped) {
        clearMaxHeight(wrapper);
      }

      setClipped(_clipped);
    };

    if (supportsResizeObserver(window.ResizeObserver)) {
      const observer = new ResizeObserver(onResize);
      observerRef.current = observer;
      observer.observe(content);

      return () => {
        observer.disconnect();
        if (observerRef.current === observer) {
          observerRef.current = null;
        }
      };
    }

    // If resize observer is not supported, query for rect and call onResize
    // with an entry that mimics the ResizeObserverEntry.
    const rect = content.getBoundingClientRect();
    const entry: ResizeObserverEntry = {
      target: content,
      contentRect: rect,
      contentBoxSize: [{blockSize: rect.height, inlineSize: rect.width}],
      borderBoxSize: [{blockSize: rect.height, inlineSize: rect.width}],
      devicePixelContentBoxSize: [{blockSize: rect.height, inlineSize: rect.width}],
    };
    onResize([entry]);
    return;
  }, [clipFlex, clipHeight, clipped, revealed]);

  const showMoreButton = (
    <Button
      size="xs"
      variant="primary"
      onClick={handleReveal}
      aria-label={props.btnText ?? DEFAULT_BUTTON_TEXT}
      {...props.buttonProps}
    >
      {props.btnText ?? DEFAULT_BUTTON_TEXT}
    </Button>
  );

  const showLessButton = (
    <Button
      size="xs"
      variant="secondary"
      onClick={handleCollapse}
      aria-label={props.collapseBtnText ?? DEFAULT_COLLAPSE_BUTTON_TEXT}
      {...props.buttonProps}
    >
      {props.collapseBtnText ?? DEFAULT_COLLAPSE_BUTTON_TEXT}
    </Button>
  );

  const showCollapseButton = props.collapsible && revealed && !clipped;

  return (
    <Wrapper
      ref={onWrapperRef}
      className={props.className}
      onTransitionEnd={handleTransitionEnd}
    >
      <div ref={onContentRef}>
        {props.title ? <Title>{props.title}</Title> : null}
        {props.children}
        {clipped
          ? (props.clipFade?.({showMoreButton}) ?? <ClipFade>{showMoreButton}</ClipFade>)
          : null}
        {showCollapseButton ? <CollapseButton>{showLessButton}</CollapseButton> : null}
      </div>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  position: relative;
  padding: ${p => p.theme.space.lg} 0;
  overflow: hidden;
  will-change: max-height;
  transition: max-height 500ms ease-in-out;
`;

const Title = styled('h5')`
  margin-bottom: ${p => p.theme.space.md};
`;

const ClipFade = styled('div')`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 40px 0 0;
  background-image: linear-gradient(
    180deg,
    ${p => color(p.theme.tokens.background.primary).alpha(0.15).string()},
    ${p => p.theme.tokens.background.primary}
  );
  text-align: center;
  border-bottom: ${p => p.theme.space.lg} solid ${p => p.theme.tokens.background.primary};
  /* Let pointer-events pass through ClipFade to visible elements underneath it */
  pointer-events: none;
  /* Ensure pointer-events trigger event listeners on "Expand" button */
  > * {
    pointer-events: auto;
  }
`;

const CollapseButton = styled('div')`
  text-align: center;
  margin-bottom: ${p => p.theme.space.lg};
`;
