import {useCallback} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import LazyLoad from 'sentry/components/lazyLoad';
import {Event} from 'sentry/types/event';

type Props = {
  event: Event;
  orgSlug: string;
  projectSlug: string;
  replayId: string;
};

export default function EventReplay({replayId, orgSlug, projectSlug, event}: Props) {
  const component = useCallback(() => import('./replayContent'), []);

  return (
    <ErrorBoundary mini>
      <LazyLoad
        component={component}
        replaySlug={`${projectSlug}:${replayId}`}
        orgSlug={orgSlug}
        event={event}
      />
    </ErrorBoundary>
  );
}
