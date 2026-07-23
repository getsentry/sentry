import styled from '@emotion/styled';

import {Tooltip, type TooltipProps} from '@sentry/scraps/tooltip';

import {ProgressState} from 'sentry/types/group';
import {getProgressIcon} from 'sentry/views/issueList/utils/progress';

import {formatActivityMarkerState, type ActivityMarkerState} from './variant';

interface ProgressMarkerProps {
  state: ActivityMarkerState;
  label?: string;
  tooltipProps?: Omit<TooltipProps, 'children' | 'skipWrapper' | 'title'>;
}

export function ActivityProgressMarker({
  label: labelOverride,
  state,
  tooltipProps,
}: ProgressMarkerProps) {
  const label = labelOverride ?? formatActivityMarkerState(state);
  const marker =
    state === 'activity' ? (
      <ProgressDotFrame aria-label={label} role="img">
        <ProgressDot />
      </ProgressDotFrame>
    ) : (
      <ProgressIconFrame aria-label={label} role="img">
        {getProgressIcon(state)}
      </ProgressIconFrame>
    );

  if (state === 'activity' || state === ProgressState.FIX_APPLIED) {
    return marker;
  }

  return (
    <Tooltip title={label} {...tooltipProps} skipWrapper>
      {marker}
    </Tooltip>
  );
}

const ProgressIconFrame = styled('span')`
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid ${p => p.theme.tokens.border.transparent.neutral.muted};
  border-radius: 100%;
  background: ${p => p.theme.tokens.background.primary};
`;

const ProgressDotFrame = styled('span')`
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
`;

const ProgressDot = styled('span')`
  width: 10px;
  height: 10px;
  border-radius: 100%;
  background: ${p => p.theme.tokens.graphics.neutral.moderate};
  /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
  box-shadow: 0 0 0 4px ${p => p.theme.tokens.background.primary};
`;
