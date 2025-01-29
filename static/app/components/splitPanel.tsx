import {createContext, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {IconGrabbable} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

export type DividerProps = {
  'data-is-held': boolean;
  'data-slide-direction': 'leftright' | 'updown';
  onDoubleClick: React.MouseEventHandler<HTMLElement>;
  onMouseDown: React.MouseEventHandler<HTMLElement>;
  icon?: React.ReactNode;
} & React.DOMAttributes<HTMLDivElement>;

export const BaseSplitDivider = styled(({icon, ...props}: DividerProps) => (
  <div {...props}>{icon || <IconGrabbable size="sm" />}</div>
))<DividerProps>`
  display: grid;
  place-items: center;
  height: 100%;
  width: 100%;

  user-select: inherit;
  background: inherit;

  &:hover,
  &[data-is-held='true'] {
    background: ${p => p.theme.hover};
  }
  &[data-is-held='true'] {
    user-select: none;
  }

  &[data-slide-direction='leftright'] {
    cursor: ew-resize;
    height: 100%;
    width: ${space(2)};
  }
  &[data-slide-direction='updown'] {
    cursor: ns-resize;
    width: 100%;
    height: ${space(2)};

    & > svg {
      transform: rotate(90deg);
    }
  }
`;

export const SplitPanelContext = createContext({
  isMaximized: false,
  isMinimized: false,
  maximiseSize: () => {},
  minimiseSize: () => {},
  resetSize: () => {},
});

type Side = {
  content: React.ReactNode;
  default: number;
  max: number;
  min: number;
};

type CommonProps = {
  availableSize: number;
  SplitDivider?: React.ComponentType<DividerProps>;
  onMouseDown?: (sizePct: `${number}%`) => void;
  onResize?: (newSize: number) => void;
  sizeStorageKey?: string;
};

export type SplitPanelProps = CommonProps &
  (
    | {
        availableSize: number;
        /**
         * Content on the left side of the split
         */
        left: Side;
        /**
         * Content on the right side of the split
         */
        right: React.ReactNode;
      }
    | {
        availableSize: number;
        /**
         * Content below the split
         */
        bottom: React.ReactNode;
        /**
         * Content above of the split
         */
        top: Side;
      }
  );

function SplitPanel(props: SplitPanelProps) {
  const {
    availableSize,
    SplitDivider = BaseSplitDivider,
    onMouseDown,
    onResize,
    sizeStorageKey,
  } = props;
  const isLeftRight = 'left' in props;
  const initialSize = isLeftRight ? props.left.default : props.top.default;
  const min = isLeftRight ? props.left.min : props.top.min;
  const max = isLeftRight ? props.left.max : props.top.max;

  const {
    isHeld,
    onDoubleClick,
    onMouseDown: onDragStart,
    size: containerSize,
    setSize,
  } = useResizableDrawer({
    direction: isLeftRight ? 'left' : 'down',
    initialSize,
    min,
    onResize: onResize ?? (() => {}),
    sizeStorageKey,
  });

  const sizePct = `${(Math.min(containerSize, max) / availableSize) * 100}%` as const;

  const handleMouseDown = useCallback(
    (event: any) => {
      onMouseDown?.(sizePct);
      onDragStart(event);
    },
    [onDragStart, sizePct, onMouseDown]
  );

  const isMaximized = containerSize >= max;
  const isMinimized = containerSize <= min;

  const contextValue = useMemo(
    () => ({
      isMaximized,
      isMinimized,
      maximiseSize: () => setSize(max),
      minimiseSize: () => setSize(min),
      resetSize: () => setSize(initialSize),
    }),
    [isMaximized, isMinimized, setSize, max, min, initialSize]
  );

  if (isLeftRight) {
    const {left: a, right: b} = props;

    return (
      <SplitPanelContext.Provider value={contextValue}>
        <SplitPanelContainer
          className={isHeld ? 'disable-iframe-pointer' : undefined}
          orientation="columns"
          size={sizePct}
        >
          <Panel>{a.content}</Panel>
          <SplitDivider
            data-is-held={isHeld}
            data-slide-direction="leftright"
            onDoubleClick={onDoubleClick}
            onMouseDown={handleMouseDown}
          />
          <Panel>{b}</Panel>
        </SplitPanelContainer>
      </SplitPanelContext.Provider>
    );
  }

  const {top: a, bottom: b} = props;
  return (
    <SplitPanelContext.Provider value={contextValue}>
      <SplitPanelContainer
        orientation="rows"
        size={sizePct}
        className={isHeld ? 'disable-iframe-pointer' : undefined}
      >
        <Panel>{a.content}</Panel>
        <SplitDivider
          data-is-held={isHeld}
          data-slide-direction="updown"
          onDoubleClick={onDoubleClick}
          onMouseDown={handleMouseDown}
        />
        <Panel>{b}</Panel>
      </SplitPanelContainer>
    </SplitPanelContext.Provider>
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
