import {useCallback, useEffect} from 'react';

import {AutofixCodebaseIndexingStatus} from 'sentry/components/events/autofix/types';
import {makeAutofixSetupQueryKey} from 'sentry/components/events/autofix/useAutofixSetup';
import {
  type ApiQueryKey,
  setApiQueryData,
  useApiQuery,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';
import useProjectFromId from 'sentry/utils/useProjectFromId';

const POLL_INTERVAL = 2500;

const makeCodebaseIndexCreateUrl = (orgSlug: string, projectIdOrSlug: string): string =>
  `/projects/${orgSlug}/${projectIdOrSlug}/autofix/codebase-index/create/`;

const makeCodebaseIndexStatusQueryKey = (
  orgSlug: string,
  projectIdOrSlug: string
): ApiQueryKey => [
  `/projects/${orgSlug}/${projectIdOrSlug}/autofix/codebase-index/status/`,
];

const isPolling = (status: AutofixCodebaseIndexingStatus | undefined) =>
  status === AutofixCodebaseIndexingStatus.INDEXING;

export interface CodebaseIndexingStatusResponse {
  status: AutofixCodebaseIndexingStatus;
}

export function useAutofixCodebaseIndexing({
  projectId,
  groupId,
}: {
  groupId: string;
  projectId: string;
}) {
  const organization = useOrganization();
  const projectSlug = useProjectFromId({project_id: projectId})?.slug;
  const api = useApi();
  const queryClient = useQueryClient();

  const {data: apiData} = useApiQuery<CodebaseIndexingStatusResponse>(
    makeCodebaseIndexStatusQueryKey(organization.slug, projectSlug ?? ''),
    {
      staleTime: 0,
      retry: false,
      enabled: projectSlug !== undefined,
      refetchInterval: data => {
        if (isPolling(data?.[0]?.status)) {
          return POLL_INTERVAL;
        }
        return false;
      },
    }
  );

  const status = apiData?.status ?? null;
  const prevStatus = usePrevious(status);

  const startIndexing = useCallback(() => {
    if (!projectSlug) {
      return;
    }

    // Triggering the create endpoint on the seer side should make it start return indexing status...
    api.requestPromise(makeCodebaseIndexCreateUrl(organization.slug, projectSlug), {
      method: 'POST',
    });

    // We set it anyways to trigger the polling
    setApiQueryData<CodebaseIndexingStatusResponse>(
      queryClient,
      makeCodebaseIndexStatusQueryKey(organization.slug, projectSlug),
      {
        status: AutofixCodebaseIndexingStatus.INDEXING,
      }
    );
  }, [api, queryClient, organization.slug, projectSlug]);

  useEffect(() => {
    if (
      prevStatus === AutofixCodebaseIndexingStatus.INDEXING &&
      status === AutofixCodebaseIndexingStatus.UP_TO_DATE
    ) {
      queryClient.refetchQueries(makeAutofixSetupQueryKey(groupId));
    }
  }, [queryClient, groupId, prevStatus, status]);

  return {status, startIndexing};
}
