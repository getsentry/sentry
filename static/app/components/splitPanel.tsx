import {useCallback, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {IconGrabbable} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

interface DividerProps extends React.DOMAttributes<HTMLDivElement> {
  'data-is-held': boolean;
  'data-slide-direction': 'leftright' | 'updown';
  icon?: React.ReactNode;
  ref?: React.RefCallback<HTMLDivElement>;
}

const BaseSplitDivider = styled(({icon, ref, ...props}: DividerProps) => (
  <div {...props} ref={ref}>
    {icon || <IconGrabbable size="sm" />}
  </div>
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
    sizeStorageKey,
  } = props;

  const splitPanelRef = useRef<HTMLDivElement>(null);
  const isLeft = 'left' in props;
  const min = isLeft ? props.left.min : props.top.min;
  const max = isLeft ? props.left.max : props.top.max;

  const initialSize = useMemo(() => {
    const storedSize = sizeStorageKey
      ? parseInt(localStorage.getItem(sizeStorageKey) ?? '', 10)
      : undefined;
    return storedSize ?? (isLeft ? props.left.default : props.top.default);
  }, [sizeStorageKey, props, isLeft]);

  const containerSizeRef = useRef<`${number}%` | null>('50%');

  const {resizing, resize, resizeHandleProps, resizedElementProps} = useResizableDrawer({
    direction: isLeft ? 'right' : 'up',
    initialSize: isLeft ? {width: initialSize} : {height: initialSize},
    min: isLeft ? {width: min} : {height: min},
    max: isLeft ? {width: max} : {height: max},
    onResize: options => {
      if (!splitPanelRef.current) {
        return null;
      }

      const sizePct = `${(options.size / availableSize) * 100}%` as const;

      splitPanelRef.current?.style.setProperty(
        `grid-template-${isLeft ? 'columns' : 'rows'}`,
        `${sizePct} auto 1fr`
      );

      containerSizeRef.current = sizePct;
      return null;
    },
  });

  const onDoubleClick = useCallback(() => {
    resize(isLeft ? {width: initialSize} : {height: initialSize});
  }, [initialSize, resize, isLeft]);

  const onPointerDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const containerSize = containerSizeRef.current;
      if (typeof containerSize === 'string') {
        onMouseDown?.(containerSize);
      }

      resizeHandleProps.onMouseDown(event);
    },
    [resizeHandleProps, onMouseDown]
  );

  if (isLeft) {
    return (
      <SplitPanelContainer
        ref={splitPanelRef}
        className={resizing ? 'disable-iframe-pointer' : undefined}
        orientation="columns"
      >
        <Panel ref={resizedElementProps.ref}>{props.left.content}</Panel>
        <SplitDivider
          data-is-held={resizing}
          data-slide-direction="leftright"
          ref={resizeHandleProps.ref}
          onDoubleClick={onDoubleClick}
          onMouseDown={onPointerDown}
        />
        <Panel>{props.right}</Panel>
      </SplitPanelContainer>
    );
  }

  return (
    <SplitPanelContainer
      ref={splitPanelRef}
      orientation="rows"
      className={resizing ? 'disable-iframe-pointer' : undefined}
    >
      <Panel>{props.top.content}</Panel>
      <SplitDivider
        data-is-held={resizing}
        data-slide-direction="updown"
        ref={resizeHandleProps.ref}
        onDoubleClick={onDoubleClick}
        onMouseDown={onPointerDown}
      />
      <Panel ref={resizedElementProps.ref}>{props.bottom}</Panel>
    </SplitPanelContainer>
  );
}

const SplitPanelContainer = styled('div')<{
  orientation: 'rows' | 'columns';
}>`
  width: 100%;
  height: 100%;

  position: relative;
  display: grid;
  overflow: auto;
  grid-template-${p => p.orientation}: 50% auto 1fr;

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
