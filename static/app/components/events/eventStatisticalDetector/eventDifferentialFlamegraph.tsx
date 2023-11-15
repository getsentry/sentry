import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {Event} from 'sentry/types';
import {useDifferentialFlamegraphQuery} from 'sentry/utils/profiling/hooks/useDifferentialFlamegraphQuery';

import {useTransactionsDelta} from './transactionsDeltaProvider';

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

  const projectID = parseInt(props.event.projectID, 10);
  const transactions = useTransactionsDelta();

  useDifferentialFlamegraphQuery({
    projectID,
    breakpoint,
    environments: [],
    transaction: transactions.data?.data?.[0]?.transaction as string,
  });

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
