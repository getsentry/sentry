import {Fragment, useCallback, useRef} from 'react';
import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import ReplayIFrameRoot from 'sentry/components/replays/player/replayIFrameRoot';
import {StaticReplayPreferences} from 'sentry/components/replays/preferences/replayPreferences';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import toPixels from 'sentry/utils/number/toPixels';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

interface Props {
  leftOffsetMs: number;
  replay: null | ReplayReader;
  rightOffsetMs: number;
}

export function ReplaySliderDiff({leftOffsetMs, replay, rightOffsetMs}: Props) {
  const positionedRef = useRef<HTMLDivElement>(null);
  const viewDimensions = useDimensions({elementRef: positionedRef});

  const width = toPixels(viewDimensions.width);
  return (
    <WithPadding>
      <Positioned ref={positionedRef}>
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
  );
}

function DiffSides({leftOffsetMs, replay, rightOffsetMs, viewDimensions, width}) {
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
      <Cover style={{width}}>
        <Placement style={{width}}>
          <ReplayContextProvider
            analyticsContext="replay_comparison_modal_left"
            initialTimeOffsetMs={{offsetMs: leftOffsetMs}}
            isFetching={false}
            prefsStrategy={StaticReplayPreferences}
            replay={replay}
          >
            <ReplayIFrameRoot viewDimensions={viewDimensions} />
          </ReplayContextProvider>
        </Placement>
      </Cover>
      <Cover ref={rightSideElem} style={{width: 0}}>
        <Placement style={{width}}>
          <ReplayContextProvider
            analyticsContext="replay_comparison_modal_right"
            initialTimeOffsetMs={{offsetMs: rightOffsetMs}}
            isFetching={false}
            prefsStrategy={StaticReplayPreferences}
            replay={replay}
          >
            <ReplayIFrameRoot viewDimensions={viewDimensions} />
          </ReplayContextProvider>
        </Placement>
      </Cover>
      <Divider ref={dividerElem} onMouseDown={onDividerMouseDownWithAnalytics} />
    </Fragment>
  );
}

const WithPadding = styled(NegativeSpaceContainer)`
  padding-block: ${space(1.5)};
  overflow: visible;
`;

const Positioned = styled('div')`
  min-height: 335px;
  position: relative;
  width: 100%;
`;

const Cover = styled('div')`
  border: 1px solid;
  height: 100%;
  overflow: hidden;
  position: absolute;
  right: 0px;
  top: 0px;

  border-color: red;
  & + & {
    border-color: green;
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
