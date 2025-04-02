import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import toPixels from 'sentry/utils/number/toPixels';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

interface BeforeAfterProps {
  label: React.ReactNode;
  children?: React.ReactNode;
  /**
   * Provides additional info about what the diff is showing
   */
  help?: React.ReactNode;
}

function BeforeAfter({children, label, help}: BeforeAfterProps) {
  return (
    <Fragment>
      <Label>
        {label}
        {help && <QuestionTooltip title={help} size="xs" />}
      </Label>
      {children}
    </Fragment>
  );
}

interface ContentSliderDiffProps {
  /**
   * The content to display after the divider. Usually an image or replay.
   */
  afterContent: React.ReactNode;
  /**
   * The content to display before the divider. Usually an image or replay.
   */
  beforeContent: React.ReactNode;
  /**
   * Provides additional info in the label's header about what the after diff is showing
   */
  afterHelp?: React.ReactNode;
  /**
   * Provides additional info in the label's header about what the before diff is showing
   */
  beforeHelp?: React.ReactNode;
  minHeight?: `${number}px` | `${number}%`;
  /**
   * A callback function triggered when the divider is clicked (mouse down event).
   * Useful when we want to track analytics.
   */
  onDividerMouseDown?: (e: React.MouseEvent) => void;
}

/**
 * Compares the before and after of visual elements using an adjustable slider.
 * It allows users to dynamically see the "before" and "after" sections by dragging a divider.
 * The before and after contents are not directly defined here and have to be provided, so it can be very flexible
 * (e.g. images, replays, etc).
 */
export function ContentSliderDiff({
  beforeHelp,
  afterHelp,
  onDividerMouseDown,
  beforeContent,
  afterContent,
  minHeight = '0px',
}: ContentSliderDiffProps) {
  const positionedRef = useRef<HTMLDivElement>(null);
  const viewDimensions = useDimensions({elementRef: positionedRef});
  const width = toPixels(viewDimensions.width);

  return (
    <Fragment>
      <DiffHeader>
        <BeforeAfter label={t('Before')} help={beforeHelp} />
        <BeforeAfter label={t('After')} help={afterHelp} />
      </DiffHeader>
      <OverflowVisibleContainer>
        <Positioned style={{minHeight}} ref={positionedRef}>
          {viewDimensions.width ? (
            <DiffSides
              viewDimensions={viewDimensions}
              width={width}
              onDividerMouseDown={onDividerMouseDown}
              beforeContent={beforeContent}
              afterContent={afterContent}
            />
          ) : (
            <div />
          )}
        </Positioned>
      </OverflowVisibleContainer>
    </Fragment>
  );
}

const BORDER_WIDTH = 3;

interface DiffSidesProps
  extends Pick<
    ContentSliderDiffProps,
    'onDividerMouseDown' | 'beforeContent' | 'afterContent'
  > {
  viewDimensions: {height: number; width: number};
  width: string | undefined;
}

function DiffSides({
  onDividerMouseDown,
  viewDimensions,
  width,
  beforeContent,
  afterContent,
}: DiffSidesProps) {
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
          <FullHeightContainer>{afterContent}</FullHeightContainer>
        </Placement>
      </Cover>
      <Cover ref={beforeElemRef} data-test-id="before-content">
        <Placement style={{width}}>
          <FullHeightContainer>{beforeContent}</FullHeightContainer>
        </Placement>
      </Cover>
      <Divider
        data-test-id="divider"
        ref={dividerElem}
        onMouseDown={event => {
          onDividerMouseDown?.(event);
          onMouseDown(event);
        }}
      />
    </Fragment>
  );
}

const DiffHeader = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(1)};
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: 1.2;
  justify-content: space-between;

  & > *:first-child {
    color: ${p => p.theme.red300};
  }

  & > *:last-child {
    color: ${p => p.theme.green300};
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
  background: ${p => p.theme.diffSliderDivider};
  position: absolute;
  top: 0;
  transform: translate(-0.5px, 0);

  &::before,
  &::after {
    background: ${p => p.theme.diffSliderDivider};
    border-radius: var(--handle-size);
    border: var(--line-width) solid ${p => p.theme.diffSliderDivider};
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

  border-color: ${p => p.theme.green300};
  & + & {
    border: ${BORDER_WIDTH}px solid;
    border-radius: ${space(0.5)} 0 0 ${space(0.5)};
    border-color: ${p => p.theme.red300};
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
