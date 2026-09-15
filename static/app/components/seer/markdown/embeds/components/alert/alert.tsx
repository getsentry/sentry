import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {AlertLink} from 'sentry/components/seer/markdown/embeds/components/alert/alertLink';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

const LazyAlertBlock = lazy(() => import('./alertBlock'));

export const Alert = defineSeerEmbed({
  name: 'alert',
  render(props, level) {
    if (level === 'block') {
      return <LazyLoad LazyComponent={LazyAlertBlock} {...props} />;
    }
    return <AlertLink {...props} />;
  },
});
