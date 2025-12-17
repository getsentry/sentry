import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

/**
 * Returns true if the user has access to replay data based on the organization's replay permissions settings.
 */
export function useHasReplayAccess() {
  const organization = useOrganization();
  const user = useUser();
  const hasFeature = organization.features.includes('granular-replay-permissions');

  if (isActiveSuperuser() || !hasFeature || !organization.hasGranularReplayPermissions) {
    return true;
  }

  return organization.replayAccessMembers.includes(parseInt(user.id, 10));
}
