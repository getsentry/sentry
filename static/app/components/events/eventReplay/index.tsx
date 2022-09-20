import {useState} from 'react';

import Button from 'sentry/components/button';
import ErrorBoundary from 'sentry/components/errorBoundary';
import EventDataSection from 'sentry/components/events/eventDataSection';
import LazyLoad from 'sentry/components/lazyLoad';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {t} from 'sentry/locale';

type Props = {
  orgSlug: string;
  projectSlug: string;
  replayId: string;
  eventTimestamp?: string;
};

export default function EventReplay({
  replayId,
  orgSlug,
  projectSlug,
  eventTimestamp,
}: Props) {
  const [initialTimeOffset, setInitialTimeOffset] = useState<number | undefined>(
    undefined
  );

  const getInitialTimeOffset = startTimestampMs => {
    if (eventTimestamp && startTimestampMs) {
      const timeOffset = Math.trunc(
        relativeTimeInMs(eventTimestamp, startTimestampMs) / 1000 - 5
      ); // 5 seconds before event

      setInitialTimeOffset(timeOffset);
      return timeOffset;
    }
    return 0;
  };

  const getReplayHref = () => ({
    pathname: `/organizations/${orgSlug}/replays/${projectSlug}:${replayId}/`,
    query: {
      t_main: 'console',
      f_c_logLevel: 'error',
      f_c_search: undefined,
      ...(initialTimeOffset ? {t: initialTimeOffset} : {}),
    },
  });

  return (
    <EventDataSection
      type="replay"
      title={t('Replay')}
      actions={
        <Button size="sm" priority="primary" to={getReplayHref}>
          {t('View Details')}
        </Button>
      }
    >
      <ErrorBoundary mini>
        <LazyLoad
          component={() => import('./replayContent')}
          replaySlug={`${projectSlug}:${replayId}`}
          orgSlug={orgSlug}
          getInitialTimeOffset={getInitialTimeOffset}
        />
      </ErrorBoundary>
    </EventDataSection>
  );
}
