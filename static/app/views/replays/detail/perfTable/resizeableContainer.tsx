import type {MouseEventHandler, ReactNode} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import toPixels from 'sentry/utils/number/toPixels';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

interface Props {
  children: [ReactNode, ReactNode];
  containerWidth: number;
  max: number;
  min: number;
  onResize: (newSize: number, maybeOldSize?: number | undefined) => void;
}

function ResizeableContainer({children, containerWidth, min, max, onResize}: Props) {
  const {isHeld, onDoubleClick, onMouseDown, size} = useResizableDrawer({
    direction: 'left',
    initialSize: containerWidth / 2,
    min,
    onResize,
  });

  const leftPx = toPixels(Math.min(size, max));
  return (
    <Fragment>
      <ResizeableContainerGrid style={{gridTemplateColumns: `${leftPx} 1fr`}}>
        {children}
      </ResizeableContainerGrid>

      <Grabber
        data-is-held={isHeld}
        data-slide-direction="leftright"
        onDoubleClick={onDoubleClick}
        onMouseDown={onMouseDown}
        style={{left: leftPx}}
      />
    </Fragment>
  );
}

const ResizeableContainerGrid = styled('div')`
  display: grid;
`;

interface GrabberProps {
  'data-is-held': boolean;
  'data-slide-direction': 'leftright' | 'updown';
  onDoubleClick: MouseEventHandler<HTMLElement>;
  onMouseDown: MouseEventHandler<HTMLElement>;
}

const Grabber = styled('div')<GrabberProps>`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 6px;
  transform: translate(-3px, 0);
  z-index: ${p => p.theme.zIndex.initial};

  cursor: grab;
  cursor: col-resize;

  &:after {
    content: '';
    position: absolute;
    top: 0;
    left: 2.5px;
    height: 100%;
    width: 1px;
    transform: translate(-0.5px, 0);
    z-index: ${p => p.theme.zIndex.initial};
    background: ${p => p.theme.border};
  }
  &:hover:after,
  &[data-is-held='true']:after {
    left: 1.5px;
    width: 3px;
    background: ${p => p.theme.black};
  }
`;
export default ResizeableContainer;
