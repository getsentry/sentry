import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import type {GroupActivity} from 'sentry/types/group';
import {
  ActivityLineActor,
  renderActivityLineActor,
} from 'sentry/views/issueDetails/activitySection/activityLineItem/actor';

import {ActivityProgressMarker} from './progressMarker';
import {getActivityMarkerState} from './variant';

export function ActivityLineMarker({
  item,
  showProgress,
}: {
  item: GroupActivity;
  showProgress: boolean;
}) {
  return (
    <LeadingCells>
      <MarkerCell>
        {showProgress ? (
          <ActivityProgressMarker state={getActivityMarkerState(item)} />
        ) : (
          (renderActivityLineActor(item) ?? <ActivityLineDot />)
        )}
      </MarkerCell>
      {showProgress ? <ActivityLineActor item={item} /> : null}
    </LeadingCells>
  );
}

function ActivityLineDot() {
  return <NeutralLineDot aria-label={t('Activity update')} role="img" />;
}

const LeadingCells = styled('div')`
  grid-column: 1;
  grid-row: 1;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 22px;
  gap: ${p => p.theme.space.xs};

  @container activity-list (min-width: 90px) {
    gap: ${p => p.theme.space.sm};
  }
`;

const MarkerCell = styled('div')`
  display: grid;
  place-items: center;
  min-width: 22px;
  min-height: 22px;
  margin-top: -2px;
`;

const NeutralLineDot = styled('span')`
  width: 8px;
  height: 8px;
  border-radius: 100%;
  background: ${p => p.theme.tokens.graphics.neutral.moderate};
  /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
  box-shadow: 0 0 0 4px ${p => p.theme.tokens.background.primary};
`;
