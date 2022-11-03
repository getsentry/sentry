import {useCallback, useEffect} from 'react';

import {getCommitters} from 'sentry/actionCreators/committers';
import {Client} from 'sentry/api';
import CommitterStore, {getCommitterStoreKey} from 'sentry/stores/committerStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Committer, Organization, ReleaseCommitter} from 'sentry/types';
import useApi from 'sentry/utils/useApi';

import useOrganization from './useOrganization';

interface Props {
  eventId: string;
  projectSlug: string;
}

interface Result {
  committers: Committer[];
  fetching: boolean;
  // TODO(scttcper): Not optional on GA of release-committer-assignees flag
  releaseCommitters?: ReleaseCommitter[];
}

async function fetchCommitters(
  api: Client,
  organization: Organization,
  projectSlug: string,
  eventId: string
) {
  const repoData = CommitterStore.get(organization.slug, projectSlug, eventId);

  if ((!repoData.committers && !repoData.committersLoading) || repoData.committersError) {
    await getCommitters(api, {
      orgSlug: organization.slug,
      projectSlug,
      eventId,
    });
  }
}

function useCommitters({eventId, projectSlug}: Props): Result {
  const api = useApi();
  const organization = useOrganization();
  const store = useLegacyStore(CommitterStore);

  const loadCommitters = useCallback(async () => {
    await fetchCommitters(api, organization!, projectSlug, eventId);
  }, [api, organization, projectSlug, eventId]);

  useEffect(() => {
    if (!organization) {
      return;
    }

    loadCommitters();
  }, [eventId, loadCommitters, organization]);

  const key = getCommitterStoreKey(organization?.slug ?? '', projectSlug, eventId);
  return {
    committers: store[key]?.committers ?? [],
    releaseCommitters: store[key]?.releaseCommitters ?? [],
    fetching: store[key]?.committersLoading ?? false,
  };
}

export default useCommitters;
