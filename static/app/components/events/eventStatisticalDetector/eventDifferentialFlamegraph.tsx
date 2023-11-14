import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {Event} from 'sentry/types';

interface EventDifferenialFlamegraphProps {
  event: Event;
}

export function EventDifferenialFlamegraph(props: EventDifferenialFlamegraphProps) {
  const evidenceData = props.event.occurrence?.evidenceData;

  const fingerprint = evidenceData?.fingerprint;
  const breakpoint = evidenceData?.breakpoint;

  const isValid = fingerprint !== undefined && breakpoint !== undefined;

  useEffect(() => {
    if (isValid) {
      return;
    }

    Sentry.withScope(scope => {
      scope.setContext('evidence data fields', {
        fingerprint,
        breakpoint,
      });

      Sentry.captureException(
        new Error('Missing required evidence data on function regression issue.')
      );
    });
  }, [isValid, fingerprint, breakpoint]);

  if (!isValid) {
    return null;
  }

  return (
    <div>
      <h3>EventDifferenialFlamegraph</h3>
      <p>TODO: Implement</p>
    </div>
  );
}
