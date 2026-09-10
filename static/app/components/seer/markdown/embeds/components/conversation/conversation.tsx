import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {ConversationLink} from './conversationLink';

const LazyConversationBlock = lazy(() => import('./conversationBlock'));

export const Conversation = defineSeerEmbed({
  name: 'conversation',
  render(props, level) {
    if (level === 'block') {
      return <LazyLoad LazyComponent={LazyConversationBlock} data={props} />;
    }
    return <ConversationLink data={props} />;
  },
});
