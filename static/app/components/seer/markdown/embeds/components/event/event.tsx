import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {EventLink} from './eventLink';

const LazySeerEventBlock = lazy(() => import('./eventBlock'));

export const SeerEvent = defineSeerEmbed({
  name: 'event',
  render(props, level) {
    switch (level) {
      case 'block':
        return <LazyLoad LazyComponent={LazySeerEventBlock} {...props} />;
      case 'markdown':
        return <EventLink {...props} format="markdown" />;
      case 'inline':
        return <EventLink {...props} />;
    }
  },
});
