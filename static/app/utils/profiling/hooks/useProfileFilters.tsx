import {useEffect, useState} from 'react';

import {Client} from 'sentry/api';
import {Organization, Tag} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type ProfileFilters = {[key: string]: Tag};

function useProfileFilters(): ProfileFilters {
  const api = useApi();
  const organization = useOrganization();

  const [profileFilters, setProfileFilters] = useState<ProfileFilters>({});

  useEffect(() => {
    api.clear();

    fetchProfileFilters(api, organization).then(_profileFilters =>
      setProfileFilters(_profileFilters)
    );
  }, [api, organization]);

  return profileFilters;
}

function fetchProfileFilters(_api: Client, _organization: Organization) {
  return Promise.resolve({}); // TODO fetch from api
}

export {useProfileFilters};
