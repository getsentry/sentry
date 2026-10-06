import type {Organization} from 'sentry/types/organization';
import {showNewSeer} from 'sentry/utils/seer/showNewSeer';

export function orgNeedsSeerTrial(organization: Organization) {
  return (
    showNewSeer(organization) &&
    !organization.features.includes('seat-based-seer-enabled') &&
    !organization.hideAiFeatures
  );
}
