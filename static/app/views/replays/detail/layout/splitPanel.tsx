import {DOMAttributes, ReactNode, useCallback} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {IconGrabbable} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import useSplitPanelTracking from 'sentry/utils/replays/hooks/useSplitPanelTracking';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

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
        <Divider
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
      <Divider
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

type DividerProps = {isHeld: boolean; slideDirection: 'leftright' | 'updown'};
const Divider = styled(
  ({
    isHeld: _a,
    slideDirection: _b,
    ...props
  }: DividerProps & DOMAttributes<HTMLDivElement>) => (
    <div {...props}>
      <IconGrabbable size="sm" />
    </div>
  )
)<DividerProps>`
  display: grid;
  place-items: center;
  height: 100%;
  width: 100%;

  ${p => (p.isHeld ? 'user-select: none;' : '')}

  :hover {
    background: ${p => p.theme.hover};
  }

  ${p =>
    p.slideDirection === 'leftright'
      ? `
        cursor: ew-resize;
        height: 100%;
        width: ${space(2)};
      `
      : `
        cursor: ns-resize;
        width: 100%;
        height: ${space(2)};

        & > svg {
          transform: rotate(90deg);
        }
      `}
`;

export default SplitPanel;
