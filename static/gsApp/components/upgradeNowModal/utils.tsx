import type {Organization} from 'sentry/types/organization';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';

export function redirectToManage(
  navigate: ReactRouter3Navigate,
  organization: Organization
) {
  navigate(
    normalizeUrl({
      pathname: `/checkout/${organization.slug}/`,
      query: {
        referrer: 'replay_onboard-error-redirect',
      },
    }),
    {replace: true}
  );
}
