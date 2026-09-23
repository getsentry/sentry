import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {MonitorLink} from 'sentry/components/seer/markdown/embeds/components/monitor/monitorLink';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

const LazyMonitorBlock = lazy(() => import('./monitorBlock'));

export const Monitor = defineSeerEmbed({
  name: 'monitor',
  render(props, level) {
    switch (level) {
      case 'block':
        return <LazyLoad LazyComponent={LazyMonitorBlock} {...props} />;
      case 'markdown':
        return <MonitorLink {...props} format="markdown" />;
      case 'inline':
        return <MonitorLink {...props} />;
    }
  },
});
