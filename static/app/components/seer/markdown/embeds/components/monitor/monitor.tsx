import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {MonitorLink} from 'sentry/components/seer/markdown/embeds/components/monitor/monitorLink';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

const LazyMonitorBlock = lazy(() => import('./monitorBlock'));

export const Monitor = defineSeerEmbed({
  name: 'monitor',
  render(props, level) {
    if (level === 'block') {
      return <LazyLoad LazyComponent={LazyMonitorBlock} {...props} />;
    }
    return <MonitorLink {...props} />;
  },
});
