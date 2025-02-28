import type {Organization} from 'sentry/types/organization';

import {usePlanMigrations} from 'getsentry/hooks/usePlanMigrations';
import type {Subscription} from 'getsentry/types';

import PendingChanges from './pendingChanges';
import PlanMigrationActive from './planMigrationActive';

type Props = {
  organization: Organization;
  subscription: Subscription;
};

function DecidePendingChanges({subscription, organization}: Props) {
  const {planMigrations, isLoading} = usePlanMigrations();
  if (isLoading) {
    return null;
  }

  const activeMigration = planMigrations.find(
    ({dateApplied, cohort}) => dateApplied === null && cohort?.nextPlan
  );

  return activeMigration ? (
    <PlanMigrationActive subscription={subscription} migration={activeMigration} />
  ) : (
    <PendingChanges subscription={subscription} organization={organization} />
  );
}

export default DecidePendingChanges;
