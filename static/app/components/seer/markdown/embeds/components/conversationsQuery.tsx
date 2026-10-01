import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {ConversationsQueryLink} from './conversationsQueryLink';

const LazyConversationsQueryBlock = lazy(() => import('./conversationsQueryBlock'));

export const ConversationsQuery = defineSeerEmbed({
  name: 'conversationsQuery',
  render(props, level) {
    switch (level) {
      case 'block':
        return <LazyLoad LazyComponent={LazyConversationsQueryBlock} data={props} />;
      case 'markdown':
        return <ConversationsQueryLink data={props} format="markdown" />;
      case 'inline':
        return <ConversationsQueryLink data={props} />;
    }
  },
});
