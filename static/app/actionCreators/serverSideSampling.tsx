import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';
import {Organization, Project} from 'sentry/types';
import {SamplingDistribution, SamplingSdkVersion} from 'sentry/types/sampling';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';

export function fetchSamplingSdkVersions({
  api,
  orgSlug,
}: {
  api: Client;
  orgSlug: Organization['slug'];
}): Promise<SamplingSdkVersion[]> {
  const {samplingDistribution} = ServerSideSamplingStore.getState();

  const projectIds = samplingDistribution.project_breakdown?.map(
    projectBreakdown => projectBreakdown.project_id
  );

  const promise = api.requestPromise(
    `/organizations/${orgSlug}/dynamic-sampling/sdk-versions/`,
    {
      query: {
        project: projectIds,
        statsPeriod: '24h',
      },
    }
  );

  promise.then(ServerSideSamplingStore.loadSamplingSdkVersionsSuccess).catch(response => {
    const errorMessage = t('Unable to fetch sampling sdk versions');
    handleXhrErrorResponse(errorMessage)(response);
  });

  return promise;
}

export function fetchSamplingDistribution({
  api,
  orgSlug,
  projSlug,
}: {
  api: Client;
  orgSlug: Organization['slug'];
  projSlug: Project['slug'];
}): Promise<SamplingDistribution> {
  ServerSideSamplingStore.reset();

  const promise = api.requestPromise(
    `/projects/${orgSlug}/${projSlug}/dynamic-sampling/distribution/`,
    {
      query: {
        statsPeriod: '24h',
      },
    }
  );

  promise
    .then(ServerSideSamplingStore.loadSamplingDistributionSuccess)
    .catch(response => {
      const errorMessage = t('Unable to fetch sampling distribution');
      handleXhrErrorResponse(errorMessage)(response);
    });

  return promise;
}
