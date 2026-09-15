import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {ReplaysQueryLink} from './replaysQueryLink';

const LazyReplaysQueryBlock = lazy(() => import('./replaysQueryBlock'));

export const ReplaysQuery = defineSeerEmbed({
  name: 'replaysQuery',
  render(props, level) {
    if (level === 'block') {
      return <LazyLoad LazyComponent={LazyReplaysQueryBlock} data={props} />;
    }
    return <ReplaysQueryLink data={props} />;
  },
});
