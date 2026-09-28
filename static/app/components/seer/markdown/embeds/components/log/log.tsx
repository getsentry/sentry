import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {LogLink} from 'sentry/components/seer/markdown/embeds/components/log/logLink';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

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
