import styled from '@emotion/styled';

import {Grid} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {GroupActivity} from 'sentry/types/group';
import {
  ActivityLineActor,
  renderActivityLineActor,
} from 'sentry/views/issueDetails/activitySection/activityLineItem/actor';

import {ActivityProgressMarker} from './progressMarker';
import {getActivityMarkerState} from './variant';

export function ActivityLineMarker({
  actorItem,
  item,
  showProgress,
}: {
  item: GroupActivity;
  showProgress: boolean;
  actorItem?: GroupActivity;
}) {
  const activityActor = actorItem ?? item;

  return (
    <LeadingCells flow="column" autoColumns="22px" gap="sm">
      <MarkerCell>
        {showProgress ? (
          <ActivityProgressMarker state={getActivityMarkerState(item)} />
        ) : (
          (renderActivityLineActor(activityActor) ?? <ActivityLineDot />)
        )}
      </MarkerCell>
      {showProgress ? <ActivityLineActor item={activityActor} /> : null}
    </LeadingCells>
  );
}

export function ActivityLineDotMarker() {
  return (
    <LeadingCells flow="column" autoColumns="22px" gap="sm">
      <MarkerCell>
        <ActivityLineDot />
      </MarkerCell>
    </LeadingCells>
  );
}

function ActivityLineDot() {
  return <NeutralLineDot aria-label={t('Activity update')} role="img" />;
}

const LeadingCells = styled(Grid)`
  position: relative;
  z-index: 1;
  grid-column: 1;
  grid-row: 1;
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
  /* oxlint-disable-next-line @sentry/scraps/use-semantic-token */
  box-shadow: 0 0 0 4px ${p => p.theme.tokens.background.primary};
`;
