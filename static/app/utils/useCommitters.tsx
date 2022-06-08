import {useCallback, useEffect} from 'react';

import {getCommitters} from 'sentry/actionCreators/committers';
import {Client} from 'sentry/api';
import CommitterStore, {getCommitterStoreKey} from 'sentry/stores/committerStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Committer, Group, Organization} from 'sentry/types';
import useApi from 'sentry/utils/useApi';

import useOrganization from './useOrganization';

interface Props {
  eventId: string;
  projectSlug: string;
  group?: Group;
}

interface Result {
  committers: Committer[];
  fetching: boolean;
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

function useCommitters({group, eventId, projectSlug}: Props): Result {
  const api = useApi();
  const organization = useOrganization();
  const store = useLegacyStore(CommitterStore);

  const loadCommitters = useCallback(async () => {
    await fetchCommitters(api, organization!, projectSlug, eventId);
  }, [api, organization, projectSlug, eventId]);

  useEffect(() => {
    // No committers if group doesn't have any releases
    if (!group?.firstRelease || !organization) {
      return;
    }

    loadCommitters();
  }, [eventId, group?.firstRelease, loadCommitters, organization]);

  const key = getCommitterStoreKey(organization?.slug ?? '', projectSlug, eventId);
  return {
    committers: store[key]?.committers ?? [],
    fetching: store[key]?.committersLoading ?? false,
  };
}

export default useCommitters;
