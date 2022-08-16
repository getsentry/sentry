import Button from 'sentry/components/button';
import ErrorBoundary from 'sentry/components/errorBoundary';
import EventDataSection from 'sentry/components/events/eventDataSection';
import LazyLoad from 'sentry/components/lazyLoad';
import {t} from 'sentry/locale';

type Props = {
  orgSlug: string;
  projectSlug: string;
  replayId: string;
};

export default function EventReplay({replayId, orgSlug, projectSlug}: Props) {
  return (
    <EventDataSection
      type="replay"
      title={t('Replay')}
      actions={
        <Button
          size="sm"
          priority="primary"
          to={`/organizations/${orgSlug}/replays/${projectSlug}:${replayId}`}
        >
          View Details
        </Button>
      }
    >
      <ErrorBoundary mini>
        <LazyLoad
          component={() => import('./replayContent')}
          replaySlug={`${projectSlug}:${replayId}`}
          orgSlug={orgSlug}
        />
      </ErrorBoundary>
    </EventDataSection>
  );
}
