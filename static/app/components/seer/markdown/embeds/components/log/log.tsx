import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {LogLink} from './logLink';

const LazyLogBlock = lazy(() => import('./logBlock'));

export const Log = defineSeerEmbed({
  name: 'log',
  render(props, level) {
    switch (level) {
      case 'block':
        return <LazyLoad LazyComponent={LazyLogBlock} {...props} />;
      case 'markdown':
        return <LogLink {...props} format="markdown" />;
      case 'inline':
        return <LogLink {...props} />;
    }
  },
});
