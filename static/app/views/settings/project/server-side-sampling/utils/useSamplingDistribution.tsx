import {useEffect, useState} from 'react';

import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {SamplingDistribution} from 'sentry/types/sampling';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';

type Props = {
  orgSlug: Organization['slug'];
  projSlug: Project['slug'];
};

function useSamplingDistribution({orgSlug, projSlug}: Props) {
  const api = useApi();
  const [samplingDistribution, setSamplingDistribution] = useState<
    SamplingDistribution | undefined
  >(undefined);

  useEffect(() => {
    async function fetchSamplingDistribution() {
      try {
        const response = await api.requestPromise(
          `/projects/${orgSlug}/${projSlug}/dynamic-sampling/distribution/`
        );
        setSamplingDistribution(response);
      } catch (error) {
        const errorMessage = t('Unable to fetch sampling distribution');
        handleXhrErrorResponse(errorMessage)(error);
      }
    }
    fetchSamplingDistribution();
  }, [api, projSlug, orgSlug]);

  return {
    samplingDistribution,
  };
}

export default useSamplingDistribution;
