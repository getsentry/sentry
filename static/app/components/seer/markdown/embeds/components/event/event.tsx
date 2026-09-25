import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {EventLink} from 'sentry/components/seer/markdown/embeds/components/event/eventLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

const LazySeerEventBlock = lazy(() => import('./eventBlock'));

/**
 * LLMs sometimes emit numeric values for `id` and `issueId` rather than
 * strings. Coerce both to strings once here so downstream consumers always
 * receive plain strings and the schema can remain permissive.
 */
function normalizeEventIds(props: EmbedOutput<'event'>): EmbedOutput<'event'> & {
  id: string;
  issueId: string;
} {
  return {
    ...props,
    id: String(props.id),
    issueId: String(props.issueId),
  };
}

export const SeerEvent = defineSeerEmbed({
  name: 'event',
  render(props, level) {
    const normalized = normalizeEventIds(props);
    switch (level) {
      case 'block':
        return <LazyLoad LazyComponent={LazySeerEventBlock} {...normalized} />;
      case 'markdown':
        return <EventLink {...normalized} format="markdown" />;
      case 'inline':
        return <EventLink {...normalized} />;
    }
  },
});
