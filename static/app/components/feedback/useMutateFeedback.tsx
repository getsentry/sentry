import {useCallback} from 'react';
import first from 'lodash/first';

import useFeedbackCache from 'sentry/components/feedback/useFeedbackCache';
import useFeedbackQueryKeys from 'sentry/components/feedback/useFeedbackQueryKeys';
import type {Actor, GroupStatus, Organization} from 'sentry/types';
import {fetchMutation, MutateOptions, useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

type TFeedbackIds = 'all' | string[];
type TPayload = {hasSeen: boolean} | {status: GroupStatus} | {assignedTo: Actor | null};
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
  const {getListQueryKey} = useFeedbackQueryKeys();
  const {updateCached, invalidateCached} = useFeedbackCache();

  const mutation = useMutation<TData, TError, TVariables, TContext>({
    onMutate: ([ids, payload]) => {
      updateCached(ids, payload);
    },
    mutationFn: ([ids, payload]) => {
      const isSingleId = ids !== 'all' && ids.length === 1;
      const url = isSingleId
        ? `/organizations/${organization.slug}/issues/${first(ids)}/`
        : `/organizations/${organization.slug}/issues/`;

      // TODO: it would be excellent if `PUT /issues/` could return the same data
      // as `GET /issues/` when query params are set. IE: it should expand inbox & owners
      // Then we could push new data into the cache instead of re-fetching it again
      const options = isSingleId
        ? {}
        : ids === 'all'
        ? getListQueryKey()[1]!
        : {query: {id: ids}};
      return fetchMutation(api)(['PUT', url, options, payload]);
    },
    onSettled: (_resp, _error, [ids, _payload]) => {
      invalidateCached(ids);
    },
    cacheTime: 0,
  });

  const markAsRead = useCallback(
    (hasSeen: boolean, options?: MutateOptions<TData, TError, TVariables, TContext>) => {
      mutation.mutate([feedbackIds, {hasSeen}], options);
    },
    [mutation, feedbackIds]
  );

  const resolve = useCallback(
    (
      status: GroupStatus,
      options?: MutateOptions<TData, TError, TVariables, TContext>
    ) => {
      mutation.mutate([feedbackIds, {status}], options);
    },
    [mutation, feedbackIds]
  );

  const assign = useCallback(
    (
      assignedTo: Actor | null,
      options?: MutateOptions<TData, TError, TVariables, TContext>
    ) => {
      mutation.mutate([feedbackIds, {assignedTo}], options);
    },
    [mutation, feedbackIds]
  );

  return {
    markAsRead,
    resolve,
    assign,
  };
}
