import {useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';

import {Overlay} from 'sentry/components/overlay';
import {space} from 'sentry/styles/space';

const TOOLTIP_OFFSET = 10;
const FIXED_Y_POSITION = 20;

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
  const labelRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState({x: 100, y: FIXED_Y_POSITION});
  const [isVisible, setIsVisible] = useState(true);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!portalRef.current) {
        portalRef.current = document.getElementById('replay-timeline-player');
      }

      const portal = portalRef.current;

      if (portal) {
        const containerRect = portal.getBoundingClientRect();

        // Instead of using onMouseEnter / onMouseLeave we check if the mouse is
        // within the containerRect. This proves to be less glitchy as some
        // elements within the container may trigger an onMouseLeave even when
        // the mouse is still "inside" of the container
        const isInsideContainer =
          e.clientX >= containerRect.left &&
          e.clientX <= containerRect.right &&
          e.clientY >= containerRect.top &&
          e.clientY <= containerRect.bottom;

        setIsVisible(isInsideContainer);

        if (isInsideContainer) {
          // Only update the x position based on mouse movement
          setPosition({
            x: e.clientX + TOOLTIP_OFFSET,
            y: containerRect.top + FIXED_Y_POSITION, // Keep y position fixed relative to the top of the portal
          });

          if (labelRef.current) {
            labelRef.current.textContent = labelText;
          }
        }
      }
    },
    [labelText]
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener('mousemove', handleMouseMove);
    } else {
      setIsVisible(false);
    }

    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [enabled, handleMouseMove]);

  if (!portalRef.current) {
    return null;
  }

  return createPortal(
    <CursorLabel
      ref={labelRef}
      style={{
        left: position.x,
        top: position.y,
        display: isVisible ? 'block' : 'none',
      }}
    >
      {labelText}
    </CursorLabel>,
    document.body
  );
}

const CursorLabel = styled(Overlay)`
  font-variant-numeric: tabular-nums;
  width: max-content;
  padding: ${space(0.75)} ${space(1)};
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.2;
  position: fixed;
  pointer-events: none; /* Prevent tooltip from blocking mouse events */
`;

export default TimelineTooltip;
