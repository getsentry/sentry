import ErrorBoundary from 'sentry/components/errorBoundary';
import {Event} from 'sentry/types/event';

import ReplayContent from './replayContent';

type Props = {
  event: Event;
  orgSlug: string;
  projectSlug: string;
  replayId: string;
};

export default function EventReplay({replayId, orgSlug, projectSlug, event}: Props) {
  return (
    <ErrorBoundary mini>
      <ReplayContent
        replaySlug={`${projectSlug}:${replayId}`}
        orgSlug={orgSlug}
        event={event}
      />
    </ErrorBoundary>
  );
}
