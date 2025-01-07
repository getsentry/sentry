import {Fragment, useCallback, useRef} from 'react';
import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {useDiffCompareContext} from 'sentry/components/replays/diff/diffCompareContext';
import {After, Before, DiffHeader} from 'sentry/components/replays/diff/utils';
import ReplayPlayer from 'sentry/components/replays/player/replayPlayer';
import ReplayPlayerMeasurer from 'sentry/components/replays/player/replayPlayerMeasurer';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import toPixels from 'sentry/utils/number/toPixels';
import {ReplayPlayerPluginsContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerPluginsContext';
import {ReplayPlayerStateContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';
import {ReplayReaderProvider} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

interface Props {
  minHeight?: `${number}px` | `${number}%`;
}

const BORDER_WIDTH = 3;

export function ReplaySliderDiff({minHeight = '0px'}: Props) {
  const {replay, leftOffsetMs, rightOffsetMs} = useDiffCompareContext();

  const positionedRef = useRef<HTMLDivElement>(null);
  const viewDimensions = useDimensions({elementRef: positionedRef});
  const width = toPixels(viewDimensions.width);

  return (
    <Fragment>
      <DiffHeader>
        <Before startTimestampMs={replay.getStartTimestampMs()} offset={leftOffsetMs} />
        <After startTimestampMs={replay.getStartTimestampMs()} offset={rightOffsetMs} />
      </DiffHeader>
      <WithPadding>
        <Positioned style={{minHeight}} ref={positionedRef}>
          {viewDimensions.width ? (
            <DiffSides
              leftOffsetMs={leftOffsetMs}
              replay={replay}
              rightOffsetMs={rightOffsetMs}
              viewDimensions={viewDimensions}
              width={width}
            />
          ) : (
            <div />
          )}
        </Positioned>
      </WithPadding>
    </Fragment>
  );
}

function DiffSides({
  leftOffsetMs,
  replay,
  rightOffsetMs,
  viewDimensions,
  width,
}: {
  leftOffsetMs: number;
  replay: ReplayReader;
  rightOffsetMs: number;
  viewDimensions: {height: number; width: number};
  width: string | undefined;
}) {
  const beforeElemRef = useRef<HTMLDivElement>(null);
  const dividerElem = useRef<HTMLDivElement>(null);

  const {onMouseDown: onDividerMouseDown} = useResizableDrawer({
    direction: 'left',
    initialSize: viewDimensions.width / 2,
    min: 0,
    onResize: newSize => {
      const maxWidth = viewDimensions.width - BORDER_WIDTH;
      if (beforeElemRef.current) {
        beforeElemRef.current.style.width =
          viewDimensions.width === 0
            ? '100%'
            : toPixels(Math.max(BORDER_WIDTH, Math.min(maxWidth, newSize))) ?? '0px';
      }
      if (dividerElem.current) {
        dividerElem.current.style.left =
          toPixels(Math.max(BORDER_WIDTH, Math.min(maxWidth, newSize))) ?? '0px';
      }
    },
  });

  const organization = useOrganization();
  const dividerClickedRef = useRef(false); // once set, never flips back to false

  const onDividerMouseDownWithAnalytics: React.MouseEventHandler<HTMLElement> =
    useCallback(
      (event: React.MouseEvent<HTMLElement>) => {
        // tracks only the first mouseDown since the last render
        if (organization && !dividerClickedRef.current) {
          trackAnalytics('replay.hydration-modal.slider-interaction', {organization});
          dividerClickedRef.current = true;
        }
        onDividerMouseDown(event);
      },
      [onDividerMouseDown, organization]
    );

  return (
    <Fragment>
      <ReplayPlayerPluginsContextProvider>
        <ReplayReaderProvider replay={replay}>
          <Cover style={{width}}>
            <Placement style={{width}}>
              <ReplayPlayerStateContextProvider>
                <StyledNegativeSpaceContainer>
                  <ReplayPlayerMeasurer measure="both">
                    {style => <ReplayPlayer style={style} offsetMs={rightOffsetMs} />}
                  </ReplayPlayerMeasurer>
                </StyledNegativeSpaceContainer>
              </ReplayPlayerStateContextProvider>
            </Placement>
          </Cover>
          <Cover ref={beforeElemRef}>
            <Placement style={{width}}>
              <ReplayPlayerStateContextProvider>
                <StyledNegativeSpaceContainer>
                  <ReplayPlayerMeasurer measure="both">
                    {style => <ReplayPlayer style={style} offsetMs={leftOffsetMs} />}
                  </ReplayPlayerMeasurer>
                </StyledNegativeSpaceContainer>
              </ReplayPlayerStateContextProvider>
            </Placement>
          </Cover>
        </ReplayReaderProvider>
      </ReplayPlayerPluginsContextProvider>
      <Divider ref={dividerElem} onMouseDown={onDividerMouseDownWithAnalytics} />
    </Fragment>
  );
}

const WithPadding = styled(NegativeSpaceContainer)`
  overflow: visible;
  height: 100%;
`;

const Positioned = styled('div')`
  height: 100%;
  position: relative;
  width: 100%;
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

const Divider = styled('div')`
  --handle-size: ${space(1.5)};
  --line-width: 1px;

  cursor: ew-resize;
  width: var(--line-width);
  height: 100%;
  background: ${p => p.theme.purple400};
  position: absolute;
  top: 0;
  transform: translate(-0.5px, 0);

  &::before,
  &::after {
    background: ${p => p.theme.purple400};
    border-radius: var(--handle-size);
    border: var(--line-width) solid ${p => p.theme.purple400};
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

const StyledNegativeSpaceContainer = styled(NegativeSpaceContainer)`
  height: 100%;
`;
