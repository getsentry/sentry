import type {Organization} from 'sentry/types/organization';

import {orgHasNewSeerPlan} from './orgHasNewSeerPlan';
import {showNewSeer} from './showNewSeer';

export function orgNeedsSeerTrial(organization: Organization) {
  return (
    showNewSeer(organization) &&
    !orgHasNewSeerPlan(organization) &&
    !organization.hideAiFeatures
  );
}
