import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

export function redirectToManage(organization: Organization) {
  browserHistory.replace(
    normalizeUrl({
      pathname: `/settings/${organization.slug}/billing/checkout/`,
      query: {
        referrer: 'replay_onboard-error-redirect',
      },
    })
  );
}
