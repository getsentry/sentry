import {Fragment, useRef, type CSSProperties} from 'react';
import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {IconGrabbable} from 'sentry/icons';
import {space} from 'sentry/styles/space';
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
}

/**
 * Compares the before and after of visual elements using an adjustable slider.
 * It allows users to dynamically see the "before" and "after" sections by dragging a divider.
 * The before and after contents are not directly defined here and have to be provided, so it can be very flexible
 * (e.g. images, replays, etc).
 */
function Body({onDragHandleMouseDown, after, before, minHeight = '0px'}: Props) {
  const positionedRef = useRef<HTMLDivElement>(null);
  const viewDimensions = useDimensions({elementRef: positionedRef});

  return (
    <OverflowVisibleContainer>
      <Positioned style={{minHeight}} ref={positionedRef}>
        {viewDimensions.width ? (
          <Sides
            viewDimensions={viewDimensions}
            onDragHandleMouseDown={onDragHandleMouseDown}
            before={before}
            after={after}
          />
        ) : (
          <div />
        )}
      </Positioned>
    </OverflowVisibleContainer>
  );
}

const BORDER_WIDTH = 3;

interface SideProps extends Pick<Props, 'onDragHandleMouseDown' | 'before' | 'after'> {
  viewDimensions: ReturnType<typeof useDimensions>;
}

function Sides({onDragHandleMouseDown, viewDimensions, before, after}: SideProps) {
  const beforeElemRef = useRef<HTMLDivElement>(null);
  const dividerElem = useRef<HTMLDivElement>(null);
  const width = `${viewDimensions.width}px`;

  const {onMouseDown, onDoubleClick} = useResizableDrawer({
    direction: 'left',
    initialSize: viewDimensions.width / 2,
    min: 0,
    onResize: newSize => {
      const maxWidth = viewDimensions.width - BORDER_WIDTH;
      const clampedSize = Math.max(BORDER_WIDTH, Math.min(maxWidth, newSize));

      if (beforeElemRef.current) {
        beforeElemRef.current.style.width =
          viewDimensions.width === 0
            ? '100%'
            : `${Math.max(BORDER_WIDTH, Math.min(maxWidth, newSize))}px`;
      }
      if (dividerElem.current) {
        const adjustedLeft = `${clampedSize - 6}px`;
        dividerElem.current.style.left = adjustedLeft;

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
  });

  return (
    <Fragment>
      <Cover style={{width}} data-test-id="after-content">
        <Placement style={{width}}>
          <FullHeightContainer>{after}</FullHeightContainer>
        </Placement>
      </Cover>
      <Cover ref={beforeElemRef} data-test-id="before-content">
        <Placement style={{width}}>
          <FullHeightContainer>{before}</FullHeightContainer>
        </Placement>
      </Cover>
      <DragHandle
        data-test-id="drag-handle"
        ref={dividerElem}
        onMouseDown={event => {
          onDragHandleMouseDown?.(event);
          onMouseDown(event);
        }}
        onDoubleClick={onDoubleClick}
      >
        <DragIndicator>
          <IconGrabbable size="sm" />
        </DragIndicator>
      </DragHandle>
    </Fragment>
  );
}

const Header = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(1)};
  font-weight: ${p => p.theme.fontWeight.bold};
  line-height: 1.2;
  justify-content: space-between;
  margin-bottom: ${space(0.5)};

  & > *:first-child {
    color: ${p => p.theme.error};
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

const Positioned = styled('div')`
  height: 100%;
  position: relative;
  width: 100%;
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
  padding: ${space(0.5)} ${space(0.25)};
`;

const DragHandle = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  width: 12px;
  height: 100%;
  cursor: ew-resize;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: ${p => p.theme.tokens.border.primary};
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

const Cover = styled('div')`
  border: ${BORDER_WIDTH}px solid;
  border-radius: ${space(0.5)};
  height: 100%;
  overflow: hidden;
  position: absolute;
  left: 0px;
  top: 0px;

  border-color: ${p => p.theme.tokens.content.success};
  & + & {
    border: ${BORDER_WIDTH}px solid;
    border-radius: ${space(0.5)} 0 0 ${space(0.5)};
    border-color: ${p => p.theme.error};
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
