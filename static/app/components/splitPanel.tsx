import {createContext, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {IconGrabbable} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

interface DividerProps extends React.DOMAttributes<HTMLDivElement> {
  'data-is-held': boolean;
  'data-slide-direction': 'leftright' | 'updown';
  icon?: React.ReactNode;
}

const BaseSplitDivider = styled(({icon, ...props}: DividerProps) => (
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

const SplitPanelContext = createContext({
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
  const isLeft = 'left' in props;
  const min = isLeft ? props.left.min : props.top.min;
  const max = isLeft ? props.left.max : props.top.max;

  const initialSize = useMemo(() => {
    const storedSize = sizeStorageKey
      ? parseInt(localStorage.getItem(sizeStorageKey) ?? '', 10)
      : undefined;
    return storedSize ?? (isLeft ? props.left.default : props.top.default);
  }, [sizeStorageKey, props, isLeft]);

  const [containerSize, setContainerSize] = useState(initialSize);

  const {resizing, resizeHandleProps, resizedElementProps} = useResizableDrawer({
    direction: isLeft ? 'left' : 'down',
    initialSize: isLeft ? {width: initialSize} : {height: initialSize},
    min: isLeft ? {width: min} : {height: min},
    onResize: options => {
      setContainerSize(options.size);
      onResize?.(options.size);
      return options.size;
    },
  });

  const sizePct = `${(Math.min(containerSize, max) / availableSize) * 100}%` as const;

  const handlePointerDown = useCallback(
    (event: any) => {
      onMouseDown?.(sizePct);
      resizeHandleProps.onPointerDown(event);
    },
    [onMouseDown, sizePct, resizeHandleProps]
  );

  const isMaximized = containerSize >= max;
  const isMinimized = containerSize <= min;

  const contextValue = useMemo(
    () => ({
      isMaximized,
      isMinimized,
      maximiseSize: () => setContainerSize(max),
      minimiseSize: () => setContainerSize(min),
      resetSize: () => setContainerSize(initialSize),
    }),
    [isMaximized, isMinimized, setContainerSize, max, min, initialSize]
  );

  const onDoubleClick = useCallback(() => {
    setContainerSize(initialSize);
  }, [initialSize]);

  if (isLeft) {
    return (
      <SplitPanelContext value={contextValue}>
        <SplitPanelContainer
          ref={resizedElementProps.ref}
          className={resizing ? 'disable-iframe-pointer' : undefined}
          orientation="columns"
          size={sizePct}
        >
          <Panel>{props.left.content}</Panel>
          <SplitDivider
            data-is-held={resizing}
            data-slide-direction="leftright"
            onDoubleClick={onDoubleClick}
            onMouseDown={handlePointerDown}
          />
          <Panel>{props.right}</Panel>
        </SplitPanelContainer>
      </SplitPanelContext>
    );
  }

  return (
    <SplitPanelContext value={contextValue}>
      <SplitPanelContainer
        ref={resizedElementProps.ref}
        orientation="rows"
        size={sizePct}
        className={resizing ? 'disable-iframe-pointer' : undefined}
      >
        <Panel>{props.top.content}</Panel>
        <SplitDivider
          data-is-held={resizing}
          data-slide-direction="updown"
          onDoubleClick={onDoubleClick}
          onPointerDown={handlePointerDown}
        />
        <Panel>{props.bottom}</Panel>
      </SplitPanelContainer>
    </SplitPanelContext>
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

  /*
   * This is more specific, with <code>&&</code> than the foundational rule:
   * <code>&[data-inspectable='true'] .replayer-wrapper > iframe</code>
   */
  &&.disable-iframe-pointer iframe {
    pointer-events: none !important;
  }
`;

const Panel = styled('div')`
  overflow: hidden;
`;

export default SplitPanel;
