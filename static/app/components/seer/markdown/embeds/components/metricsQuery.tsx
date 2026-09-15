import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {MetricsQueryLink} from './metricsQueryLink';

const LazyMetricsQueryBlock = lazy(() => import('./metricsQueryBlock'));

export const MetricsQuery = defineSeerEmbed({
  name: 'metricsQuery',
  render(props, level) {
    if (level === 'block') {
      return <LazyLoad LazyComponent={LazyMetricsQueryBlock} data={props} />;
    }
    return <MetricsQueryLink data={props} />;
  },
});
