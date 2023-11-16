import {useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';
import color from 'color';

import {Button, ButtonProps} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

function isClipped(args: {clipFlex: number; clipHeight: number; height: number}) {
  return args.height > args.clipHeight + args.clipFlex;
}

function supportsResizeObserver(
  observerOrUndefined: unknown
): observerOrUndefined is ResizeObserver {
  return typeof observerOrUndefined !== 'undefined';
}

function revealAndDisconnectObserver({
  observerRef,
  revealRef,
  wrapperRef,
}: {
  observerRef: React.MutableRefObject<ResizeObserver | null>;
  revealRef: React.MutableRefObject<boolean>;
  wrapperRef: React.MutableRefObject<HTMLElement | null>;
}) {
  if (!wrapperRef.current) {
    return;
  }

  wrapperRef.current.style.maxHeight = '9999px';
  revealRef.current = true;

  if (observerRef.current) {
    observerRef.current.disconnect();
    observerRef.current = null;
  }
}

const DEFAULT_BUTTON_TEXT = t('Show More');
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

function ClippedBox(props: ClippedBoxProps) {
  const revealRef = useRef(false);
  const mountedRef = useRef(false);

  const observerRef = useRef<ResizeObserver | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const [clipped, setClipped] = useState(!!props.defaultClipped);

  const onReveal = props.onReveal;
  const onSetRenderHeight = props.onSetRenderedHeight;

  const clipHeight = props.clipHeight || 200;
  const clipFlex = props.clipFlex || 28;

  const handleReveal = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!wrapperRef.current) {
        throw new Error('Cannot reveal clipped box without a wrapper ref');
      }

      event.stopPropagation();

      revealAndDisconnectObserver({wrapperRef, revealRef, observerRef});
      if (typeof onReveal === 'function') {
        onReveal();
      }

      setClipped(false);
    },
    [onReveal]
  );

  const onWrapperRef = useCallback(
    (node: HTMLDivElement | null) => {
      wrapperRef.current = node;
      if (!wrapperRef.current) {
        return;
      }

      // Initialize the height to the clip height + clip flex
      wrapperRef.current.style.maxHeight = `${clipHeight}px`;
    },
    [clipHeight]
  );

  const onContentRef = useCallback(
    (node: HTMLDivElement | null) => {
      // If the component is revealed, we have nothing to do here
      if (revealRef.current) {
        return;
      }

      contentRef.current = node;
      // Disconnect the current observer if it exists
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      // If we have no node, we can't observe it
      if (!contentRef.current) {
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

        if (!mountedRef.current && typeof onSetRenderHeight === 'function') {
          onSetRenderHeight(height);
          mountedRef.current = true;
        }

        const _clipped = isClipped({
          clipFlex,
          clipHeight,
          height,
        });

        if (!_clipped && contentRef.current) {
          revealAndDisconnectObserver({wrapperRef, revealRef, observerRef});
        }

        setClipped(_clipped);
      };

      if (supportsResizeObserver(window.ResizeObserver)) {
        observerRef.current = new ResizeObserver(onResize);
        observerRef.current.observe(contentRef.current);
        return;
      }

      // If resize observer is not supported, query for rect and call onResize
      // with an entry that mimics the ResizeObserverEntry.
      const rect: DOMRectReadOnly = contentRef.current.getBoundingClientRect();
      const entry: ResizeObserverEntry = {
        target: contentRef.current,
        contentRect: rect,
        contentBoxSize: [{blockSize: rect.height, inlineSize: rect.width}],
        borderBoxSize: [{blockSize: rect.height, inlineSize: rect.width}],
        devicePixelContentBoxSize: [{blockSize: rect.height, inlineSize: rect.width}],
      };
      onResize([entry]);
    },
    [clipFlex, clipHeight, onSetRenderHeight]
  );

  const showMoreButton = (
    <Button
      size="xs"
      priority="primary"
      onClick={handleReveal}
      aria-label={props.btnText ?? DEFAULT_BUTTON_TEXT}
      {...props.buttonProps}
    >
      {props.btnText ?? DEFAULT_BUTTON_TEXT}
    </Button>
  );

  return (
    <Wrapper ref={onWrapperRef} className={props.className}>
      <div ref={onContentRef}>
        {props.title ? <Title>{props.title}</Title> : null}
        {props.children}
        {clipped
          ? props.clipFade?.({showMoreButton}) ?? <ClipFade>{showMoreButton}</ClipFade>
          : null}
      </div>
    </Wrapper>
  );
}

export default ClippedBox;

const Wrapper = styled('div')`
  position: relative;
  padding: ${space(1.5)} 0;
  overflow: hidden;
  will-change: max-height;
  transition: all 5s ease-in-out 0s;
`;

const Title = styled('h5')`
  margin-bottom: ${space(1)};
`;

export const ClipFade = styled('div')`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 40px 0 0;
  background-image: linear-gradient(
    180deg,
    ${p => color(p.theme.background).alpha(0.15).string()},
    ${p => p.theme.background}
  );
  text-align: center;
  border-bottom: ${space(1.5)} solid ${p => p.theme.background};
  /* Let pointer-events pass through ClipFade to visible elements underneath it */
  pointer-events: none;
  /* Ensure pointer-events trigger event listeners on "Expand" button */
  > * {
    pointer-events: auto;
  }
`;
