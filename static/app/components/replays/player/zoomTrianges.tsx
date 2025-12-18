import {Fragment} from 'react';
import styled from '@emotion/styled';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import {space} from 'sentry/styles/space';
import divide from 'sentry/utils/number/divide';
import toPercent from 'sentry/utils/number/toPercent';
import useTimelineScale from 'sentry/utils/replays/hooks/useTimelineScale';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';

export default function ZoomTriangles() {
  const replay = useReplayReader();
  const {currentTime} = useReplayContext();

  const [timelineScale] = useTimelineScale();

  const durationMs = replay?.getDurationMs() ?? 0;
  const percentComplete = divide(currentTime, durationMs);

  const initialTranslate = 0.5 / timelineScale;

  const starting = percentComplete < initialTranslate;
  const ending = percentComplete + initialTranslate > 1;

  const translate = () => {
    if (starting) {
      return 0;
    }
    if (ending) {
      return 1 - 2 * initialTranslate;
    }
    return currentTime > durationMs ? 1 : percentComplete - initialTranslate;
  };

  return (
    <Fragment>
      <ZoomIndicatorContainer style={{left: toPercent(translate())}}>
        <ZoomTriangleDown />
      </ZoomIndicatorContainer>
      <ZoomIndicatorContainer
        style={{left: toPercent(translate() + 2 * initialTranslate)}}
      >
        <ZoomTriangleDown />
      </ZoomIndicatorContainer>
    </Fragment>
  );
}

const ZoomIndicatorContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(0.75)};
  translate: -50% -12px;
`;

const ZoomTriangleDown = styled('div')`
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 4px solid ${p => p.theme.colors.gray800};
`;
