import {
  ActivityLineDot,
  ActivityLineDotMarker,
  ActivityLineLeadingCells,
  ActivityLineMarkerCell,
} from 'sentry/components/activityLine/marker';
import type {GroupActivity} from 'sentry/types/group';
import {
  ActivityLineActor,
  renderActivityLineActor,
} from 'sentry/views/issueDetails/activitySection/activityLineItem/actor';

import {ActivityProgressMarker} from './progressMarker';
import {getActivityMarkerState} from './variant';

export {ActivityLineDotMarker};

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
    <ActivityLineLeadingCells>
      <ActivityLineMarkerCell>
        {showProgress ? (
          <ActivityProgressMarker state={getActivityMarkerState(item)} />
        ) : (
          (renderActivityLineActor(activityActor) ?? <ActivityLineDot />)
        )}
      </ActivityLineMarkerCell>
      {showProgress ? <ActivityLineActor item={activityActor} /> : null}
    </ActivityLineLeadingCells>
  );
}
