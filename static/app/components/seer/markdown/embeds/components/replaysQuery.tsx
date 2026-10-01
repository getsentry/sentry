import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {ReplaysQueryLink} from './replaysQueryLink';

const LazyReplaysQueryBlock = lazy(() => import('./replaysQueryBlock'));

export const ReplaysQuery = defineSeerEmbed({
  name: 'replaysQuery',
  render(props, level) {
    switch (level) {
      case 'block':
        return <LazyLoad LazyComponent={LazyReplaysQueryBlock} data={props} />;
      case 'markdown':
        return <ReplaysQueryLink data={props} format="markdown" />;
      case 'inline':
        return <ReplaysQueryLink data={props} />;
    }
  },
});
