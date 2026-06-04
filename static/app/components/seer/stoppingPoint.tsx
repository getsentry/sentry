import {Fragment} from 'react';

import {PROJECT_STOPPING_POINT_OPTIONS} from 'sentry/utils/seer/stoppingPoint';
import type {UserFacingStoppingPoint} from 'sentry/utils/seer/types';

/**
 * Render a user-facing stopping point to its human-readable label.
 */
export function StoppingPointLabel({
  stoppingPoint,
}: {
  stoppingPoint: UserFacingStoppingPoint;
}) {
  return (
    <Fragment>
      {PROJECT_STOPPING_POINT_OPTIONS.find(o => o.value === stoppingPoint)?.label ??
        stoppingPoint}
    </Fragment>
  );
}
