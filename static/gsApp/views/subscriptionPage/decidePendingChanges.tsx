import type {Organization} from 'sentry/types/organization';

import type {Subscription} from 'getsentry/types';

import {PendingChanges} from './pendingChanges';

type Props = {
  organization: Organization;
  subscription: Subscription;
};

export function DecidePendingChanges({subscription, organization}: Props) {
  return <PendingChanges subscription={subscription} organization={organization} />;
}
