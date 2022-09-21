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
  return (
    <ErrorBoundary mini>
      <LazyLoad
        component={() => import('./replayContent')}
        replaySlug={`${projectSlug}:${replayId}`}
        orgSlug={orgSlug}
        event={event}
      />
    </ErrorBoundary>
  );
}
