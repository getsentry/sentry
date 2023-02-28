import {useEffect, useState} from 'react';

import {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {Organization, PageFilters, Tag, TagCollection} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface ProfileFiltersOptions {
  query: string;
  disabled?: boolean;
  selection?: PageFilters;
}

function useProfileFilters({
  query,
  selection,
  disabled,
}: ProfileFiltersOptions): TagCollection {
  const api = useApi();
  const organization = useOrganization();

  const [profileFilters, setProfileFilters] = useState<TagCollection>({});

  useEffect(() => {
    if (disabled || !selection) {
      return undefined;
    }

    fetchProfileFilters(api, organization, query, selection).then(response => {
      const withPredefinedFilters = response.reduce(
        (filters: TagCollection, tag: Tag) => {
          if (TAG_KEY_MAPPING[tag.key]) {
            // for now, we're going to use this translation to handle auto
            // completion but we should update the response in the future
            tag.key = TAG_KEY_MAPPING[tag.key];
            filters[tag.key] = {
              ...tag,
              // predefined allows us to specify a list of possible values
              predefined: true,
            };
          }
          return filters;
        },
        {}
      );

      setProfileFilters(withPredefinedFilters);
    });

    return () => api.clear();
  }, [api, organization, query, selection, disabled]);

  return profileFilters;
}

function fetchProfileFilters(
  api: Client,
  organization: Organization,
  query: string,
  selection: PageFilters
): Promise<[Tag]> {
  return api.requestPromise(`/organizations/${organization.slug}/profiling/filters/`, {
    method: 'GET',
    query: {
      query,
      project: selection.projects,
      environment: selection.environments,
      ...normalizeDateTimeParams(selection.datetime),
    },
  });
}

const TAG_KEY_MAPPING = {
  version: 'release',
  device_locale: 'device.locale',
  platform: 'platform.name',
  transaction_name: 'transaction',
  device_os_build_number: 'os.build',
  device_os_name: 'os.name',
  device_os_version: 'os.version',
  device_model: 'device.model',
  device_manufacturer: 'device.manufacturer',
  device_classification: 'device.classification',
};

export {useProfileFilters};
