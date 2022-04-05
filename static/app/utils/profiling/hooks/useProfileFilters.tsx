import {useEffect, useState} from 'react';

import {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {Organization, PageFilters, Tag} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type ProfileFilters = Record<string, Tag>;

interface UseProfileFiltersOptions {
  selection: PageFilters | undefined;
}

function useProfileFilters({selection}: UseProfileFiltersOptions): ProfileFilters {
  const api = useApi();
  const organization = useOrganization();

  const [profileFilters, setProfileFilters] = useState<ProfileFilters>({});

  useEffect(() => {
    api.clear();

    fetchProfileFilters(api, organization, selection).then(_profileFilters => {
      setProfileFilters(
        _profileFilters.reduce((filters: ProfileFilters, tag: Tag) => {
          filters[tag.key] = {
            ...tag,
            predefined: true,
          };
          return filters;
        }, {})
      );
    });
  }, [api, organization, selection]);

  return profileFilters;
}

function fetchProfileFilters(
  api: Client,
  organization: Organization,
  selection: PageFilters | undefined
): Promise<[Tag]> {
  const query = selection
    ? {
        project: selection.projects,
        environment: selection.environments,
        ...normalizeDateTimeParams(selection.datetime),
      }
    : undefined;

  return api.requestPromise(`/organizations/${organization.slug}/profiling/filters/`, {
    method: 'GET',
    query,
  });
}

export {useProfileFilters};
