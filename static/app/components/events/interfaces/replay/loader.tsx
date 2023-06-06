import {useCallback} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import LazyLoad from 'sentry/components/lazyLoad';
import type {Organization} from 'sentry/types';
import type {Entry, EntryType, Event} from 'sentry/types/event';

interface Props {
  data: Extract<Entry, {type: EntryType.REPLAY}>['data'];
  event: Event;
  organization: Organization;
  projectSlug: string;
  isShare?: boolean;
}

function Loader({data, event, organization}: Props) {
  const replayPreview = useCallback(
    () => import('sentry/components/events/eventReplay/replayPreview'),
    []
  );

  return (
    <ErrorBoundary mini>
      <LazyLoad
        component={replayPreview}
        event={event}
        orgSlug={organization.slug}
        replaySlug={data.replayId}
      />
    </ErrorBoundary>
  );
}

export default Loader;
