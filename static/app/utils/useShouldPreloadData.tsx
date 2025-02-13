import {useLocation} from 'react-router-dom';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {useParams} from 'sentry/utils/useParams';

// Skips data preload if the user is on an invitation acceptance page (e.g., 403 errors).
// This frontend check is needed along with the backend check (see: https://github.com/getsentry/sentry/blob/cac47187ae98f105b39edf80a0fd3105c95e1cb5/src/sentry/web/client_config.py#L402-L414).
// It's necessary because when using `yarn dev-ui`, the app is an SPA, and routing happens client-side without a full page reload.
export function useShouldPreloadData(): boolean {
  const location = useLocation();
  const config = useLegacyStore(ConfigStore);
  const {orgId, memberId, token} = useParams<{
    memberId?: string;
    orgId?: string;
    token?: string;
  }>();

  const inviteRoutes = [
    `/accept/${orgId}/${memberId}/${token}/`,
    `/accept/${memberId}/${token}/`,
  ];

  return !inviteRoutes.includes(location.pathname) && config.shouldPreloadData;
}
