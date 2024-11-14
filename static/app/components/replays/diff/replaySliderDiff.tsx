import {Fragment, useCallback, useRef} from 'react';
import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {After, Before, DiffHeader} from 'sentry/components/replays/diff/utils';
import ReplayPlayer from 'sentry/components/replays/player/replayPlayer';
import ReplayPlayerMeasurer from 'sentry/components/replays/player/replayPlayerMeasurer';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import toPixels from 'sentry/utils/number/toPixels';
import {ReplayPlayerEventsContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerEventsContext';
import {ReplayPlayerPluginsContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerPluginsContext';
import {ReplayPlayerStateContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

interface Props {
  leftOffsetMs: number;
  replay: ReplayReader;
  rightOffsetMs: number;
  minHeight?: `${number}px` | `${number}%`;
}

export function ReplaySliderDiff({
  minHeight = '0px',
  leftOffsetMs,
  replay,
  rightOffsetMs,
}: Props) {
  const positionedRef = useRef<HTMLDivElement>(null);
  const viewDimensions = useDimensions({elementRef: positionedRef});
  const width = toPixels(viewDimensions.width);

  return (
    <Fragment>
      <DiffHeader>
        <Before />
        <After />
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
  const rightSideElem = useRef<HTMLDivElement>(null);
  const dividerElem = useRef<HTMLDivElement>(null);

  const {onMouseDown: onDividerMouseDown} = useResizableDrawer({
    direction: 'left',
    initialSize: viewDimensions.width / 2,
    min: 0,
    onResize: newSize => {
      if (rightSideElem.current) {
        rightSideElem.current.style.width =
          viewDimensions.width === 0
            ? '100%'
            : toPixels(Math.min(viewDimensions.width, viewDimensions.width - newSize)) ??
              '0px';
      }
      if (dividerElem.current) {
        dividerElem.current.style.left =
          toPixels(Math.min(viewDimensions.width, newSize)) ?? '0px';
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
        <ReplayPlayerEventsContextProvider replay={replay}>
          <Cover style={{width}}>
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
          <Cover ref={rightSideElem} style={{width: 0}}>
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
        </ReplayPlayerEventsContextProvider>
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
  border: 3px solid;
  border-radius: ${space(0.5)};
  height: 100%;
  overflow: hidden;
  position: absolute;
  right: 0px;
  top: 0px;

  border-color: ${p => p.theme.red300};
  & + & {
    border-color: ${p => p.theme.green300};
    border-left-color: transparent;
  }
`;

const Placement = styled('div')`
  display: flex;
  height: 100%;
  justify-content: center;
  position: absolute;
  right: 0;
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
