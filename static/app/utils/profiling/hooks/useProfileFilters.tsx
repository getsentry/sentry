import {useEffect, useState} from 'react';

import {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {Organization, PageFilters, Tag} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type ProfileFilters = Record<string, Tag>;

function useProfileFilters(selection: PageFilters | undefined): ProfileFilters {
  const api = useApi();
  const organization = useOrganization();

  const [profileFilters, setProfileFilters] = useState<ProfileFilters>({});

  useEffect(() => {
    api.clear();

    if (!selection) {
      return;
    }

    fetchProfileFilters(api, organization, selection).then(response => {
      const withPredefinedFilters = response.reduce(
        (filters: ProfileFilters, tag: Tag) => {
          filters[tag.key] = {
            ...tag,
            // predefined allows us to specify a list of possible values
            predefined: true,
          };
          return filters;
        },
        {}
      );

      setProfileFilters(withPredefinedFilters);
    });
  }, [api, organization, selection]);

  return profileFilters;
}

function fetchProfileFilters(
  api: Client,
  organization: Organization,
  selection: PageFilters
): Promise<[Tag]> {
  return api.requestPromise(`/organizations/${organization.slug}/profiling/filters/`, {
    method: 'GET',
    query: {
      project: selection.projects,
      environment: selection.environments,
      ...normalizeDateTimeParams(selection.datetime),
    },
  });
}

export {useProfileFilters};
