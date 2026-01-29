import {Alert} from 'sentry/components/core/alert';

import type {Subscription} from 'getsentry/types';

type Props = {
  orgStatus: Subscription['orgStatus'];
};

function OrganizationStatus({orgStatus}: Props) {
  if (!orgStatus) {
    return null;
  }

  if (orgStatus.id === 'visible') {
    return null;
  }

  let message: string | undefined = undefined;

  switch (orgStatus.id) {
    case 'pending_deletion':
      message = 'This organization has been queued for deletion.';
      break;
    case 'deletion_in_progress':
      message = 'This organization in the process of being deleted.';
      break;
    default:
      break;
  }

  if (!message) {
    return null;
  }

  return (
    <Alert.Container>
      <Alert data-test-id="deletion-status" variant="danger">
        {message}
      </Alert>
    </Alert.Container>
  );
}

export default OrganizationStatus;
