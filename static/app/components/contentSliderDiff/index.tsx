import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import toPixels from 'sentry/utils/number/toPixels';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

export interface ContentSliderDiffBodyProps {
  /**
   * The content to display after the divider. Usually an image or replay.
   */
  after: React.ReactNode;
  /**
   * The content to display before the divider. Usually an image or replay.
   */
  before: React.ReactNode;
  minHeight?: `${number}px` | `${number}%`;
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
function Body({
  onDragHandleMouseDown,
  after,
  before,
  minHeight = '0px',
}: ContentSliderDiffBodyProps) {
  const positionedRef = useRef<HTMLDivElement>(null);
  const viewDimensions = useDimensions({elementRef: positionedRef});
  const width = toPixels(viewDimensions.width);

  return (
    <OverflowVisibleContainer>
      <Positioned style={{minHeight}} ref={positionedRef}>
        {viewDimensions.width ? (
          <Sides
            viewDimensions={viewDimensions}
            width={width}
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

export interface ContentSliderDiffBeforeOrAfterLabelProps {
  children?: React.ReactNode;
  help?: React.ReactNode;
}

function BeforeLabel({help, children}: ContentSliderDiffBeforeOrAfterLabelProps) {
  return (
    <div>
      <Label>
        {t('Before')}
        {help && <QuestionTooltip title={help} size="xs" />}
      </Label>
      {children}
    </div>
  );
}

function AfterLabel({help, children}: ContentSliderDiffBeforeOrAfterLabelProps) {
  return (
    <div>
      <Label>
        {t('After')}
        {help && <QuestionTooltip title={help} size="xs" />}
      </Label>
      {children}
    </div>
  );
}

const BORDER_WIDTH = 3;

interface ContentSliderDiffSidesProps
  extends Pick<ContentSliderDiffBodyProps, 'onDragHandleMouseDown' | 'before' | 'after'> {
  viewDimensions: {height: number; width: number};
  width: string | undefined;
}

function Sides({
  onDragHandleMouseDown,
  viewDimensions,
  width,
  before,
  after,
}: ContentSliderDiffSidesProps) {
  const beforeElemRef = useRef<HTMLDivElement>(null);
  const dividerElem = useRef<HTMLDivElement>(null);

  const {onMouseDown} = useResizableDrawer({
    direction: 'left',
    initialSize: viewDimensions.width / 2,
    min: 0,
    onResize: newSize => {
      const maxWidth = viewDimensions.width - BORDER_WIDTH;
      if (beforeElemRef.current) {
        beforeElemRef.current.style.width =
          viewDimensions.width === 0
            ? '100%'
            : (toPixels(Math.max(BORDER_WIDTH, Math.min(maxWidth, newSize))) ?? '0px');
      }
      if (dividerElem.current) {
        dividerElem.current.style.left =
          toPixels(Math.max(BORDER_WIDTH, Math.min(maxWidth, newSize))) ?? '0px';
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
      <Divider
        data-test-id="drag-handle"
        ref={dividerElem}
        onMouseDown={event => {
          onDragHandleMouseDown?.(event);
          onMouseDown(event);
        }}
      />
    </Fragment>
  );
}

const Header = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(1)};
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: 1.2;
  justify-content: space-between;

  & > *:first-child {
    color: ${p => p.theme.error};
  }

  & > *:last-child {
    color: ${p => p.theme.success};
  }
  margin-bottom: ${space(0.5)};
`;

const Label = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
  font-weight: bold;
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

const Divider = styled('div')`
  --handle-size: ${space(1.5)};
  --line-width: 1px;

  cursor: ew-resize;
  width: var(--line-width);
  height: 100%;
  background: ${p => p.theme.diffSliderDragHandleHover};
  position: absolute;
  top: 0;
  transform: translate(-0.5px, 0);

  &::before,
  &::after {
    background: ${p => p.theme.diffSliderDragHandleHover};
    border-radius: var(--handle-size);
    border: var(--line-width) solid ${p => p.theme.diffSliderDragHandleHover};
    content: '';
    height: var(--handle-size);
    position: absolute;
    width: var(--handle-size);
    z-index: 1;
  }
  &::before {
    top: 0;
    transform: translate(calc(var(--handle-size) / -2 + var(--line-width) / 2), -100%);
  }
  &::after {
    bottom: 0;
    transform: translate(calc(var(--handle-size) / -2 + var(--line-width) / 2), 100%);
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

  border-color: ${p => p.theme.success};
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
  BeforeLabel,
  AfterLabel,
};
