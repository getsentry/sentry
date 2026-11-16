import {useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';

import {
  explorerAutofixApiOptions,
  getPollInterval,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {Group} from 'sentry/types/group';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useOrganization} from 'sentry/utils/useOrganization';

const STOPPED_STATUSES = new Set(['completed', 'error', 'awaiting_user_input']);

export function useAutofixUnread(
  group: Group,
  {enabled, isViewing}: {enabled: boolean; isViewing: boolean}
): boolean {
  const organization = useOrganization();
  const {data} = useQuery({
    ...explorerAutofixApiOptions(organization.slug, group.id),
    enabled,
    refetchInterval: query =>
      getPollInterval({
        autofixState: query.state.data?.json?.autofix ?? null,
        runStarted: false,
      }),
  });
  const [seenAt, setSeenAt] = useLocalStorageState<string | null>(
    `autofix-seen:${group.id}`,
    null
  );

  const runState = data?.autofix;
  const stoppedAt =
    runState && STOPPED_STATUSES.has(runState.status) ? runState.updated_at : null;

  useEffect(() => {
    if (isViewing && stoppedAt && stoppedAt !== seenAt) {
      setSeenAt(stoppedAt);
    }
  }, [isViewing, stoppedAt, seenAt, setSeenAt]);

  return enabled && !isViewing && stoppedAt !== null && stoppedAt !== seenAt;
}
