import {useLayoutEffect, useState} from 'react';

import type {Client} from 'sentry/api';
import type {RequestState} from 'sentry/types/core';
import type {Event} from 'sentry/types/event';
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

  useLayoutEffect(() => {
    if (eventId === null || !projectSlug || !organizationSlug) {
      return undefined;
    }

    setRequestState({type: 'loading'});

    fetchSentryEvent<T>(api, organizationSlug, projectSlug, eventId)
      .then(event => {
        setRequestState({
          type: 'resolved',
          data: event,
        });
      })
      .catch(err => {
        setRequestState({type: 'errored', error: err});
      });

    return () => {
      api.clear();
    };
  }, [api, organizationSlug, projectSlug, eventId]);

  return requestState;
}
