import type {ReactNode} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import toPixels from 'sentry/utils/number/toPixels';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import Grabber from 'sentry/views/replays/detail/perfTable/grabber';

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

export default ResizeableContainer;
