import {useEffect, useState} from 'react';

import {Client} from 'sentry/api';
import {Event, RequestState} from 'sentry/types';
import useApi from 'sentry/utils/useApi';

function fetchSentryEvent<T extends Event>(
  api: Client,
  organizationSlug: string,
  projectSlug: string,
  eventId: string
): Promise<T> {
  return api.requestPromise(
    `/projects/${organizationSlug}/${projectSlug}/events/${eventId}/`
  );
}

export function useSentryEvent<T extends Event>(
  organizationSlug: string,
  projectSlug: string,
  eventId: string | null
): RequestState<T> {
  const api = useApi();
  const [requestState, setRequestState] = useState<RequestState<T>>({
    type: 'initial',
  });

  useEffect(() => {
    if (eventId === null) {
      return undefined;
    }

    let unmounted = false;

    fetchSentryEvent<T>(api, organizationSlug, projectSlug, eventId)
      .then(transaction => {
        if (unmounted) {
          return;
        }
        setRequestState({
          type: 'resolved',
          data: transaction,
        });
      })
      .catch(err => {
        if (unmounted) {
          return;
        }
        setRequestState({type: 'errored', error: err});
      });

    return () => {
      unmounted = true;
    };
  }, [api, organizationSlug, projectSlug, eventId]);

  return requestState;
}
