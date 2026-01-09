import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Overlay} from 'sentry/components/overlay';
import {Sticky} from 'sentry/components/sticky';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';

const TOOLTIP_OFFSET = 10;

export interface CursorOffsets {
  left?: number;
  right?: number;
}

interface Options {
  /**
   * Function used to compute the text of the cursor tooltip. Receives the
   * offset value within the container.
   */
  labelText: (positionX: number) => string;
  /**
   * Whether to anchor the cursor overlay to the top or bottom of the container. Defaults to 'top'
   */
  anchor?: 'top' | 'bottom';
  /**
   * The offset of the cursor overlay. If anchor is 'top', this will be added to the top offset.
   * If anchor is 'bottom', this will be added to the bottom offset.
   */
  anchorOffset?: number;
  /**
   * May be set to false to disable rendering the timeline cursor
   */
  enabled?: boolean;
  /**
   * Configures clamped offsets on the left and right of the cursor overlay
   * element. May be useful in scenarios where you do not want the overlay to
   * cover some additional UI elements
   */
  offsets?: CursorOffsets;
  /**
   * Should the label stick to the top of the screen?
   */
  sticky?: boolean;
}

function useTimelineCursor<E extends HTMLElement>({
  enabled = true,
  sticky,
  offsets,
  labelText,
  anchor = 'top',
  anchorOffset = 0,
}: Options) {
  const rafIdRef = useRef<number | null>(null);

  const containerRef = useRef<E>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  const [isVisible, setIsVisible] = useState(false);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }

      if (containerRef.current === null) {
        return;
      }

      const containerRect = containerRef.current.getBoundingClientRect();

      // Instead of using onMouseEnter / onMouseLeave we check if the mouse is
      // within the containerRect. This proves to be less glitchy as some
      // elements within the container may trigger an onMouseLeave even when
      // the mouse is still "inside" of the container
      //
      // Also tests that the mouse is not occluded by a overlay element.
      const isInsideContainer =
        e.clientX > containerRect.left &&
        e.clientX < containerRect.right &&
        e.clientY > containerRect.top &&
        e.clientY < containerRect.bottom &&
        !document
          .elementsFromPoint(e.clientX, e.clientY)
          .some(el => el.hasAttribute('data-overlay'));

      if (isInsideContainer !== isVisible) {
        setIsVisible(isInsideContainer);
      }

      rafIdRef.current = window.requestAnimationFrame(() => {
        if (containerRef.current === null || labelRef.current === null) {
          return;
        }

        if (!isInsideContainer) {
          return;
        }

        const offset = e.clientX - containerRect.left;
        const tooltipWidth = labelRef.current.offsetWidth;

        labelRef.current.innerText = labelText(offset);

        containerRef.current.style.setProperty('--cursorOffset', `${offset}px`);
        containerRef.current.style.setProperty('--cursorMax', `${containerRect.width}px`);
        containerRef.current.style.setProperty('--cursorLabelWidth', `${tooltipWidth}px`);
      });
    },
    [isVisible, labelText]
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener('mousemove', handleMouseMove);
    } else {
      setIsVisible(false);
    }

    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [enabled, handleMouseMove]);

  const labelOverlay = (
    <CursorLabel
      ref={labelRef}
      animated
      placement="right"
      offsets={offsets}
      anchor={anchor}
      anchorOffset={anchorOffset}
    />
  );
  const cursorLabel = sticky ? <StickyLabel>{labelOverlay}</StickyLabel> : labelOverlay;

  const timelineCursor = (
    <AnimatePresence>
      {isVisible && (
        <Fragment>
          <Cursor
            initial="initial"
            animate="animate"
            exit="exit"
            transition={testableTransition({duration: 0.1})}
            variants={{
              initial: {opacity: 0},
              animate: {opacity: 1},
              exit: {opacity: 0},
            }}
            role="presentation"
          />
          {cursorLabel}
        </Fragment>
      )}
    </AnimatePresence>
  );

  return {cursorContainerRef: containerRef, timelineCursor};
}

const Cursor = styled(motion.div)`
  pointer-events: none;
  background: ${p => p.theme.tokens.border.transparent.neutral.muted};
  width: 2px;
  height: 100%;
  position: absolute;
  top: 0;
  left: clamp(0px, var(--cursorOffset), var(--cursorMax));
  transform: translateX(-2px);
  z-index: 3;
`;

const CursorLabel = styled(Overlay)<{
  anchor: 'top' | 'bottom';
  anchorOffset: number;
  offsets?: CursorOffsets;
}>`
  font-variant-numeric: tabular-nums;
  width: max-content;
  padding: ${space(0.75)} ${space(1)};
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.2;
  position: absolute;
  ${p =>
    p.anchor === 'top' ? `top: ${p.anchorOffset}px;` : `bottom: ${p.anchorOffset}px;`}
  left: clamp(
    0px,
    calc(var(--cursorOffset) + ${p => p.offsets?.left ?? 0}px + ${TOOLTIP_OFFSET}px),
    calc(
      var(--cursorMax) - var(--cursorLabelWidth) - ${p => p.offsets?.right ?? 0}px -
        ${TOOLTIP_OFFSET}px
    )
  );
`;

const StickyLabel = styled(Sticky)`
  z-index: 2;
`;

export {useTimelineCursor};
