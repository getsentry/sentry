import {useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';

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
      const portal = document.getElementById('replay-timeline-player');
      portalRef.current = portal;

      if (portal) {
        const rect = portal.getBoundingClientRect();
        const isInside =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;

        setIsVisible(isInside);

        if (isInside) {
          // Only update the x position based on mouse movement
          setPosition({
            x: e.clientX + TOOLTIP_OFFSET,
            y: rect.top + FIXED_Y_POSITION, // Keep y position fixed relative to the top of the portal
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

  return createPortal(
    <TooltipLabel
      ref={labelRef}
      style={{
        left: position.x,
        top: position.y,
        display: isVisible ? 'block' : 'none',
      }}
    >
      {labelText}
    </TooltipLabel>,
    document.body
  );
}

const TooltipLabel = styled('div')`
  font-variant-numeric: tabular-nums;
  width: max-content;
  padding: ${space(0.75)} ${space(1)};
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1.2;
  position: fixed;
  background: ${p => p.theme.backgroundElevated};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow:
    0 0 0 1px ${p => p.theme.translucentBorder},
    ${p => p.theme.dropShadowHeavy};
  z-index: 1;
  pointer-events: none; /* Prevent tooltip from blocking mouse events */
`;

export default TimelineTooltip;
