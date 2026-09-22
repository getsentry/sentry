import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

import {
  ActivityLineDotGraphic,
  ActivityLineIconFrame,
} from 'sentry/components/activityLine/marker';
import {ProgressState} from 'sentry/types/group';
import {getProgressIcon} from 'sentry/views/issueList/utils/progress';

import {formatActivityMarkerState, type ActivityMarkerState} from './variant';

interface ProgressMarkerProps {
  state: ActivityMarkerState;
  label?: string;
}

export function ActivityProgressMarker({
  label: labelOverride,
  state,
}: ProgressMarkerProps) {
  const label = labelOverride ?? formatActivityMarkerState(state);
  const marker =
    state === 'activity' ? (
      <ProgressDotFrame aria-label={label} role="img">
        <ActivityLineDotGraphic size={10} />
      </ProgressDotFrame>
    ) : (
      <ActivityLineIconFrame aria-label={label} role="img">
        {getProgressIcon(state)}
      </ActivityLineIconFrame>
    );

  if (state === 'activity' || state === ProgressState.FIX_APPLIED) {
    return marker;
  }

  return (
    <Tooltip title={label} skipWrapper>
      {marker}
    </Tooltip>
  );
}

const ProgressDotFrame = styled('span')`
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
`;
