import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {SpansQueryLink} from './spansQueryLink';

const LazySpansQueryBlock = lazy(() => import('./spansQueryBlock'));

export const SpansQuery = defineSeerEmbed({
  name: 'spansQuery',
  render(props, level) {
    if (level === 'block') {
      return <LazyLoad LazyComponent={LazySpansQueryBlock} data={props} />;
    }
    return <SpansQueryLink data={props} />;
  },
});
