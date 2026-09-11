import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {ConversationsQueryLink} from './conversationsQueryLink';

const LazyConversationsQueryBlock = lazy(() => import('./conversationsQueryBlock'));

export const ConversationsQuery = defineSeerEmbed({
  name: 'conversationsQuery',
  render(props, level) {
    if (level === 'block') {
      return <LazyLoad LazyComponent={LazyConversationsQueryBlock} data={props} />;
    }
    return <ConversationsQueryLink data={props} />;
  },
});
