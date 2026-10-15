import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {MetricsQueryLink} from './metricsQueryLink';

const LazyMetricsQueryBlock = lazy(() => import('./metricsQueryBlock'));

export const MetricsQuery = defineSeerEmbed({
  name: 'metricsQuery',
  render(props, level) {
    switch (level) {
      case 'block':
        return <LazyLoad LazyComponent={LazyMetricsQueryBlock} data={props} />;
      case 'markdown':
        return <MetricsQueryLink data={props} format="markdown" />;
      case 'inline':
        return <MetricsQueryLink data={props} />;
    }
  },
});
