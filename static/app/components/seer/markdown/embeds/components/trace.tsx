import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {TraceLink} from './traceLink';

const LazyTraceBlock = lazy(() => import('./traceBlock'));

export const Trace = defineSeerEmbed({
  name: 'trace',
  render(props, level) {
    if (level === 'block') {
      return <LazyLoad LazyComponent={LazyTraceBlock} {...props} />;
    }
    return <TraceLink {...props} />;
  },
});
