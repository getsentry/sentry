import {browserHistory} from 'sentry/utils/browserHistory';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

export function redirectToManage() {
  browserHistory.replace(
    normalizeUrl({
      pathname: '/checkout/',
      query: {
        referrer: 'replay_onboard-error-redirect',
      },
    })
  );
}
