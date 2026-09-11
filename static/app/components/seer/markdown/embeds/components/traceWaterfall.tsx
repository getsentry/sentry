import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

const LazyTraceWaterfallBlock = lazy(() => import('./traceWaterfallBlock'));

/**
 * Split out of the `trace` embed so a trace reference never implies the
 * waterfall. This loads the trace's whole span tree, so Seer has to ask for it
 * by name rather than getting it for free by mentioning a trace at block level.
 */
export const TraceWaterfall = defineSeerEmbed({
  name: 'traceWaterfall',
  render(props) {
    return <LazyLoad LazyComponent={LazyTraceWaterfallBlock} {...props} />;
  },
});
