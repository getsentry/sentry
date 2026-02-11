import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

export function redirectToManage(organization: Organization) {
  browserHistory.replace(
    normalizeUrl({
      pathname: `/checkout/${organization.slug}/`,
      query: {
        referrer: 'replay_onboard-error-redirect',
      },
    })
  );
}
