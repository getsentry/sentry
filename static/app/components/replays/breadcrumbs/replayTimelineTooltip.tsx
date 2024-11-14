import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';
import {AnimatePresence} from 'framer-motion';

import {Overlay} from 'sentry/components/overlay';
import {space} from 'sentry/styles/space';

const TOOLTIP_OFFSET = 10;

type Props = {
  /**
   * Text of the cursor tooltip.
   */
  labelText: string;
  children?: React.ReactNode;
  /**
   * May be set to false to disable rendering the timeline cursor
   */
  enabled?: boolean;
};

function TimelineTooltip({enabled = true, labelText}: Props) {
  const rafIdRef = useRef<number | null>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  const [isVisible, setIsVisible] = useState(false);
  const [offsetLeft, setOffsetLeft] = useState(0);

  const portal = document.getElementById('replay-timeline-player');

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }

      if (portal === null) {
        return;
      }

      const containerRect = portal.getBoundingClientRect();

      // Instead of using onMouseEnter / onMouseLeave we check if the mouse is
      // within the containerRect. This proves to be less glitchy as some
      // elements within the container may trigger an onMouseLeave even when
      // the mouse is still "inside" of the container
      const isInsideContainer =
        e.clientX > containerRect.left &&
        e.clientX < containerRect.right &&
        e.clientY > containerRect.top &&
        e.clientY < containerRect.bottom;

      if (isInsideContainer !== isVisible) {
        setIsVisible(isInsideContainer);
      }

      rafIdRef.current = window.requestAnimationFrame(() => {
        if (portal === null || labelRef.current === null) {
          return;
        }

        setOffsetLeft(e.clientX - containerRect.left + TOOLTIP_OFFSET);

        labelRef.current.innerText = labelText;
      });
    },
    [isVisible, labelText, portal]
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener('mousemove', handleMouseMove);
    } else {
      setIsVisible(false);
    }

    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [enabled, handleMouseMove]);

  if (!portal) {
    return null;
  }

  const cursorLabel = (
    <CursorLabel
      ref={labelRef}
      animated
      overlayStyle={{transform: `translate(${offsetLeft}px, 0px) !important`}}
    />
  );

  return isVisible ? (
    <Fragment>
      {createPortal(<AnimatePresence>{cursorLabel}</AnimatePresence>, portal)}
    </Fragment>
  ) : null;
}

const CursorLabel = styled(Overlay)`
  font-variant-numeric: tabular-nums;
  width: max-content;
  padding: ${space(0.75)} ${space(1)};
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1.2;
  position: absolute;
`;

export default TimelineTooltip;
