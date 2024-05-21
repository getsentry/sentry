import {useCallback, useEffect} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {AutofixCodebaseIndexingStatus} from 'sentry/components/events/autofix/types';
import {makeAutofixSetupQueryKey} from 'sentry/components/events/autofix/useAutofixSetup';
import {t} from 'sentry/locale';
import {
  type ApiQueryKey,
  setApiQueryData,
  useApiQuery,
  useQueryClient,
} from 'sentry/utils/queryClient';
import RequestError from 'sentry/utils/requestError/requestError';
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
  reason?: string;
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
  const reason = apiData?.reason ?? null;
  const prevStatus = usePrevious(status);

  const startIndexing = useCallback(async () => {
    if (!projectSlug) {
      return;
    }

    setApiQueryData<CodebaseIndexingStatusResponse>(
      queryClient,
      makeCodebaseIndexStatusQueryKey(organization.slug, projectSlug),
      {
        status: AutofixCodebaseIndexingStatus.INDEXING,
      }
    );

    // Triggering the create endpoint on the seer side should make it start return indexing status...
    try {
      await api.requestPromise(
        makeCodebaseIndexCreateUrl(organization.slug, projectSlug),
        {
          method: 'POST',
        }
      );
    } catch (e) {
      const detail = e instanceof RequestError ? e.message : undefined;

      addErrorMessage(detail ?? t('Autofix was unable to start indexing the codebase.'));

      setApiQueryData<CodebaseIndexingStatusResponse>(
        queryClient,
        makeCodebaseIndexStatusQueryKey(organization.slug, projectSlug),
        {
          status: AutofixCodebaseIndexingStatus.ERRORED,
        }
      );
    }
  }, [api, queryClient, organization.slug, projectSlug]);

  useEffect(() => {
    if (
      prevStatus === AutofixCodebaseIndexingStatus.INDEXING &&
      status === AutofixCodebaseIndexingStatus.UP_TO_DATE
    ) {
      queryClient.refetchQueries(makeAutofixSetupQueryKey(groupId));
    }
  }, [queryClient, groupId, prevStatus, status]);

  return {status, reason, startIndexing};
}
