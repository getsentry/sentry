import {useEffect, useState} from 'react';

import {t} from 'sentry/locale';
import {SamplingDistribution} from 'sentry/types/sampling';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';

function useSamplingDistribution({orgSlug, projSlug}) {
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
      } catch (err) {
        const errorMessage = t('Unable to fetch sampling distribution');
        handleXhrErrorResponse(errorMessage)(err);
      }
    }
    fetchSamplingDistribution();
  }, [api, projSlug, orgSlug]);

  return {
    samplingDistribution,
  };
}

export default useSamplingDistribution;
