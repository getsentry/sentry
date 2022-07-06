import {useEffect, useState} from 'react';

import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {SamplingSdkVersion} from 'sentry/types/sampling';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';

type Props = {
  orgSlug: Organization['slug'];
  projSlug: Project['slug'];
  projectIds?: number[];
};

function useSdkVersions({orgSlug, projSlug, projectIds = []}: Props) {
  const api = useApi();
  const [samplingSdkVersions, setSamplingSdkVersions] = useState<
    SamplingSdkVersion[] | undefined
  >(undefined);

  useEffect(() => {
    async function fetchSamplingSdkVersions() {
      if (!projectIds.length) {
        return;
      }

      try {
        const response = await api.requestPromise(
          `/organizations/${orgSlug}/dynamic-sampling/sdk-versions/`,
          {
            method: 'GET',
            query: {
              projects: projectIds,
            },
          }
        );
        setSamplingSdkVersions(response);
      } catch (error) {
        const message = t('Unable to fetch sampling sdk versions');
        handleXhrErrorResponse(message)(error);
      }
    }
    fetchSamplingSdkVersions();
  }, [api, projSlug, orgSlug, projectIds]);

  return {
    samplingSdkVersions,
  };
}

export default useSdkVersions;
