import {useCallback, useLayoutEffect, useRef, type CSSProperties} from 'react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

import {NegativeSpaceContainer} from 'sentry/components/container/negativeSpaceContainer';
import {IconGrabbable} from 'sentry/icons';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

interface Props {
  /**
   * The content to display after the divider. Usually an image or replay.
   */
  after: React.ReactNode;
  /**
   * The content to display before the divider. Usually an image or replay.
   */
  before: React.ReactNode;
  minHeight?: CSSProperties['minHeight'];
  /**
   * A callback function triggered when the divider is clicked (mouse down event).
   * Useful when we want to track analytics.
   */
  onDragHandleMouseDown?: (e: React.MouseEvent) => void;
  showBorders?: boolean;
  visualContainerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Compares the before and after of visual elements using an adjustable slider.
 * It allows users to dynamically see the "before" and "after" sections by dragging a divider.
 * The before and after contents are not directly defined here and have to be provided, so it can be very flexible
 * (e.g. images, replays, etc).
 */
function Body({
  onDragHandleMouseDown,
  after,
  before,
  minHeight = '0px',
  showBorders = true,
  visualContainerRef,
}: Props) {
  const positionedRef = useRef<HTMLDivElement>(null);
  const dividerProgressRef = useRef(DEFAULT_DIVIDER_PROGRESS);
  const viewDimensions = useDimensions({elementRef: positionedRef});

  return (
    <OverflowVisibleContainer>
      <Container
        width="100%"
        height="100%"
        position="relative"
        minHeight={typeof minHeight === 'number' ? `${minHeight}px` : minHeight}
        ref={positionedRef}
      >
        {viewDimensions.width ? (
          <Sides
            viewDimensions={viewDimensions}
            dividerProgressRef={dividerProgressRef}
            onDragHandleMouseDown={onDragHandleMouseDown}
            showBorders={showBorders}
            visualContainerRef={visualContainerRef}
            before={before}
            after={after}
          />
        ) : (
          <div />
        )}
      </Container>
    </OverflowVisibleContainer>
  );
}

const BORDER_WIDTH = 3;
const DEFAULT_DIVIDER_PROGRESS = 0.5;

function getMaxDividerSize(containerWidth: number) {
  return Math.max(BORDER_WIDTH, containerWidth - BORDER_WIDTH);
}

function getDividerProgress(size: number, containerWidth: number) {
  if (containerWidth === 0) {
    return DEFAULT_DIVIDER_PROGRESS;
  }

  return Math.max(0, Math.min(1, size / containerWidth));
}

function getDividerPosition(progress: number, containerWidth: number) {
  return progress * containerWidth;
}

function setDividerCSSVars(el: HTMLElement | null, progress: number, positionPx: number) {
  el?.style.setProperty('--divider-progress', String(progress));
  el?.style.setProperty('--divider-position', `${positionPx}px`);
}

interface SideProps extends Pick<
  Props,
  'onDragHandleMouseDown' | 'before' | 'after' | 'showBorders' | 'visualContainerRef'
> {
  dividerProgressRef: React.MutableRefObject<number>;
  viewDimensions: ReturnType<typeof useDimensions>;
}

function Sides({
  onDragHandleMouseDown,
  viewDimensions,
  dividerProgressRef,
  showBorders = true,
  visualContainerRef,
  before,
  after,
}: SideProps) {
  const dividerElem = useRef<HTMLDivElement>(null);
  const emptyVisualContainerRef = useRef<HTMLElement>(null);
  const visualContainerDimensions = useDimensions({
    elementRef: visualContainerRef ?? emptyVisualContainerRef,
  });
  const width = `${viewDimensions.width}px`;

  const containerRef = useRef<HTMLDivElement>(null);
  const initialDividerPosition = getDividerPosition(
    dividerProgressRef.current,
    viewDimensions.width
  );
  const dividerSizeStyle = {
    '--divider-position': `${initialDividerPosition}px`,
    '--divider-progress': dividerProgressRef.current,
  } as CSSProperties;

  const applyDividerPosition = useCallback(
    (position: number) => {
      const maxWidth = getMaxDividerSize(viewDimensions.width);
      const clampedSize = Math.max(BORDER_WIDTH, Math.min(maxWidth, position));
      const progress = dividerProgressRef.current;

      setDividerCSSVars(containerRef.current, progress, clampedSize);

      if (visualContainerRef?.current && containerRef.current) {
        const visualRect = visualContainerRef.current.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        const visualPosition = containerRect.left - visualRect.left + clampedSize;
        setDividerCSSVars(visualContainerRef.current, progress, visualPosition);
      }

      if (dividerElem.current) {
        dividerElem.current.setAttribute(
          'data-at-min-width',
          String(clampedSize === maxWidth)
        );
        dividerElem.current.setAttribute(
          'data-at-max-width',
          String(clampedSize === BORDER_WIDTH)
        );
      }
    },
    [dividerProgressRef, viewDimensions.width, visualContainerRef]
  );

  const {onMouseDown, onDoubleClick, setSize} = useResizableDrawer({
    direction: 'left',
    initialSize: viewDimensions.width / 2,
    min: 0,
    onResize: (newSize, _oldSize, userEvent) => {
      if (userEvent && viewDimensions.width > BORDER_WIDTH) {
        dividerProgressRef.current = getDividerProgress(newSize, viewDimensions.width);
      }

      applyDividerPosition(
        getDividerPosition(dividerProgressRef.current, viewDimensions.width)
      );
    },
  });

  const syncDividerPosition = useCallback(() => {
    applyDividerPosition(
      getDividerPosition(dividerProgressRef.current, viewDimensions.width)
    );
  }, [applyDividerPosition, dividerProgressRef, viewDimensions.width]);

  useLayoutEffect(() => {
    syncDividerPosition();
  }, [
    syncDividerPosition,
    visualContainerDimensions.height,
    visualContainerDimensions.width,
  ]);

  const handleContainerMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 0 || !containerRef.current) {
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    setSize(relativeX, true);
    onDragHandleMouseDown?.(event);
    onMouseDown(event);
  };

  return (
    <SidesContainer
      ref={containerRef}
      onMouseDown={handleContainerMouseDown}
      style={dividerSizeStyle}
    >
      <Cover style={{width}} data-test-id="after-content" $showBorders={showBorders}>
        <Placement style={{width}}>
          <FullHeightContainer>{after}</FullHeightContainer>
        </Placement>
      </Cover>
      <Cover data-test-id="before-content" $showBorders={showBorders}>
        <Placement style={{width}}>
          <FullHeightContainer>{before}</FullHeightContainer>
        </Placement>
      </Cover>
      <DragHandle
        data-test-id="drag-handle"
        ref={dividerElem}
        onDoubleClick={onDoubleClick}
      >
        <DragIndicator>
          <IconGrabbable size="sm" />
        </DragIndicator>
      </DragHandle>
    </SidesContainer>
  );
}

const Header = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${p => p.theme.space.md};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  line-height: 1.2;
  justify-content: space-between;
  margin-bottom: ${p => p.theme.space.xs};

  & > *:first-child {
    color: ${p => p.theme.tokens.content.danger};
  }

  & > *:last-child {
    color: ${p => p.theme.tokens.content.success};
  }
`;

const FullHeightContainer = styled(NegativeSpaceContainer)`
  height: 100%;
`;

const OverflowVisibleContainer = styled(FullHeightContainer)`
  overflow: visible;
`;

const SidesContainer = styled('div')`
  position: absolute;
  inset: 0;
  cursor: ew-resize;
`;

const DragIndicator = styled('div')`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  z-index: 1;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space['2xs']};
`;

const DragHandle = styled('div')`
  position: absolute;
  top: 0;
  left: calc(
    clamp(${BORDER_WIDTH}px, var(--divider-position), calc(100% - ${BORDER_WIDTH}px)) -
      6px
  );
  width: 12px;
  height: 100%;
  cursor: ew-resize;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: ${p => p.theme.tokens.background.secondary};
    left: 50%;
    transform: translateX(-50%);
  }

  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 4px;
    background: transparent;
    transition: background 0.1s ease;
    left: 50%;
    transform: translateX(-50%);
  }

  &:hover,
  &:active {
    &::after {
      background: ${p => p.theme.tokens.graphics.accent.vibrant};
    }
  }

  &[data-at-min-width='true'] {
    cursor: w-resize;
  }

  &[data-at-max-width='true'] {
    cursor: e-resize;
  }

  &[data-resizing]::after {
    background: ${p => p.theme.tokens.graphics.accent.vibrant};
  }
`;

const Cover = styled('div')<{$showBorders: boolean}>`
  border: ${BORDER_WIDTH}px solid;
  border-radius: ${p => p.theme.space.xs};
  height: 100%;
  overflow: hidden;
  position: absolute;
  left: 0px;
  top: 0px;

  border-color: ${p =>
    p.$showBorders ? p.theme.tokens.border.success.moderate : 'transparent'};
  & + & {
    width: clamp(
      ${BORDER_WIDTH}px,
      var(--divider-position),
      calc(100% - ${BORDER_WIDTH}px)
    );
    border: ${BORDER_WIDTH}px solid;
    border-radius: ${p => p.theme.space.xs} 0 0 ${p => p.theme.space.xs};
    border-color: ${p =>
      p.$showBorders ? p.theme.tokens.border.danger.moderate : 'transparent'};
    border-right-width: 0;
  }
`;

const Placement = styled('div')`
  display: flex;
  height: 100%;
  justify-content: center;
  position: absolute;
  left: 0;
  top: 0;
  place-items: center;
`;

export const ContentSliderDiff = {
  Body,
  Header,
};
