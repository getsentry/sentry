import {ReactNode, useCallback} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import useSplitPanelTracking from 'sentry/utils/replays/hooks/useSplitPanelTracking';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import SplitDivider from 'sentry/views/replays/detail/layout/splitDivider';

type Side = {
  content: ReactNode;
  default: number;
  max: number;
  min: number;
};

type Props =
  | {
      availableSize: number;
      /**
       * Content on the right side of the split
       */
      left: Side;
      /**
       * Content on the left side of the split
       */
      right: ReactNode;
    }
  | {
      availableSize: number;
      /**
       * Content below the split
       */
      bottom: ReactNode;
      /**
       * Content above of the split
       */
      top: Side;
    };

function SplitPanel(props: Props) {
  const isLeftRight = 'left' in props;
  const initialSize = isLeftRight ? props.left.default : props.top.default;
  const min = isLeftRight ? props.left.min : props.top.min;
  const max = isLeftRight ? props.left.max : props.top.max;

  const {setStartPosition, logEndPosition} = useSplitPanelTracking({
    slideDirection: isLeftRight ? 'leftright' : 'updown',
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onResize = useCallback(
    debounce(newSize => logEndPosition(`${(newSize / props.availableSize) * 100}%`), 750),
    [debounce, logEndPosition, props.availableSize]
  );

  const {
    isHeld,
    onDoubleClick,
    onMouseDown: onDragStart,
    size: containerSize,
  } = useResizableDrawer({
    direction: isLeftRight ? 'left' : 'down',
    initialSize,
    min,
    onResize,
  });

  const sizePct = `${
    (Math.min(containerSize, max) / props.availableSize) * 100
  }%` as `${number}%`;
  const onMouseDown = useCallback(
    event => {
      setStartPosition(sizePct);
      onDragStart(event);
    },
    [setStartPosition, onDragStart, sizePct]
  );

  if (isLeftRight) {
    const {left: a, right: b} = props;

    return (
      <SplitPanelContainer
        className={isHeld ? 'disable-iframe-pointer' : undefined}
        orientation="columns"
        size={sizePct}
      >
        <Panel>{a.content}</Panel>
        <SplitDivider
          isHeld={isHeld}
          onDoubleClick={onDoubleClick}
          onMouseDown={onMouseDown}
          slideDirection="leftright"
        />
        <Panel>{b}</Panel>
      </SplitPanelContainer>
    );
  }

  const {top: a, bottom: b} = props;
  return (
    <SplitPanelContainer
      orientation="rows"
      size={sizePct}
      className={isHeld ? 'disable-iframe-pointer' : undefined}
    >
      <Panel>{a.content}</Panel>
      <SplitDivider
        isHeld={isHeld}
        onDoubleClick={onDoubleClick}
        onMouseDown={onMouseDown}
        slideDirection="updown"
      />
      <Panel>{b}</Panel>
    </SplitPanelContainer>
  );
}

const SplitPanelContainer = styled('div')<{
  orientation: 'rows' | 'columns';
  size: `${number}px` | `${number}%`;
}>`
  width: 100%;
  height: 100%;

  position: relative;
  display: grid;
  overflow: auto;
  grid-template-${p => p.orientation}: ${p => p.size} auto 1fr;

  &.disable-iframe-pointer iframe {
    pointer-events: none !important;
  }
`;

const Panel = styled('div')`
  overflow: hidden;
`;

export default SplitPanel;
