import {useQuery} from '@tanstack/react-query';

import {ResponseMeta} from 'sentry/api';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {SamplingDistribution} from 'sentry/types/sampling';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';

type Props = {
  organizationSlug: Organization['slug'];
  projectSlug: Project['slug'];
};

export function useDistribution({projectSlug, organizationSlug}: Props) {
  const api = useApi();

  const samplingDistribution = useQuery(
    ['samplingDistribution', organizationSlug, projectSlug],
    async (): Promise<SamplingDistribution> =>
      await api.requestPromise(
        `/projects/${organizationSlug}/${projectSlug}/dynamic-sampling/distribution/`
      ),
    {
      refetchOnMount: false, // This hook is being used on different components on the same page and we don't want to refetch the data on every component mount.
      onError: error => {
        const errorMessage = t('Unable to fetch sampling distribution');
        handleXhrErrorResponse(errorMessage)(error as ResponseMeta);
      },
    }
  );

  return {
    loading: samplingDistribution.isLoading,
    error: samplingDistribution.error,
    data: samplingDistribution.data,
  };
}
