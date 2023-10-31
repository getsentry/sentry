import {useCallback} from 'react';
import first from 'lodash/first';

import useFeedbackCache from 'sentry/components/feedback/useFeedbackCache';
import type {GroupStatus, Organization} from 'sentry/types';
import {fetchMutation, MutateOptions, useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

type TFeedbackIds = string[];
type TPayload = {hasSeen: boolean} | {status: GroupStatus};
type TData = unknown;
type TError = unknown;
type TVariables = [TFeedbackIds, TPayload];
type TContext = unknown;

interface Props {
  feedbackIds: TFeedbackIds;
  organization: Organization;
}

export default function useMutateFeedback({feedbackIds, organization}: Props) {
  const api = useApi({
    persistInFlight: false,
  });
  const {updateCached, invalidateCached} = useFeedbackCache();

  const mutation = useMutation<TData, TError, TVariables, TContext>({
    onMutate: ([ids, payload]) => {
      updateCached(ids, payload);
    },
    mutationFn: ([ids, payload]) => {
      const url =
        ids.length === 1
          ? `/organizations/${organization.slug}/issues/${first(ids)}/`
          : `/organizations/${organization.slug}/issues/`;

      // TODO: it would be excellent if `PUT /issues/` could return the same data
      // as `GET /issues/` when query params are set. IE: it should expand inbox & owners
      // Then we could push new data into the cache instead of re-fetching it again
      const options = ids.length === 1 ? {} : {query: {id: ids}};
      return fetchMutation(api)(['PUT', url, options, payload]);
    },
    onSettled: (_resp, _error, [ids, _payload]) => {
      invalidateCached(ids);
    },
    cacheTime: 0,
  });

  const markAsRead = useCallback(
    (hasSeen: boolean, options?: MutateOptions<TData, TError, TVariables, TContext>) =>
      mutation.mutate([feedbackIds, {hasSeen}], options),
    [mutation, feedbackIds]
  );

  const resolve = useCallback(
    (status: GroupStatus, options?: MutateOptions<TData, TError, TVariables, TContext>) =>
      mutation.mutate([feedbackIds, {status}], options),
    [mutation, feedbackIds]
  );

  return {
    markAsRead,
    resolve,
  };
}
