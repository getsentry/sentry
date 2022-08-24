import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';
import type {Organization, Project} from 'sentry/types';
import type {SamplingDistribution, SamplingSdkVersion} from 'sentry/types/sampling';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';

export function fetchSamplingSdkVersions({
  api,
  orgSlug,
  projectID,
}: {
  api: Client;
  orgSlug: Organization['slug'];
  projectID: Project['id'];
}): Promise<SamplingSdkVersion[]> {
  const {samplingDistribution} = ServerSideSamplingStore.getState();
  const {startTimestamp, endTimestamp, project_breakdown} = samplingDistribution;

  if (!startTimestamp || !endTimestamp) {
    ServerSideSamplingStore.setFetching(false);
    ServerSideSamplingStore.loadSamplingSdkVersionsSuccess([]);
    return new Promise(resolve => {
      resolve([]);
    });
  }

  const projectIds = [
    projectID,
    ...(project_breakdown?.map(projectBreakdown => projectBreakdown.project_id) ?? []),
  ];

  const promise = api.requestPromise(
    `/organizations/${orgSlug}/dynamic-sampling/sdk-versions/`,
    {
      query: {
        project: projectIds,
        start: startTimestamp,
        end: endTimestamp,
      },
    }
  );

  ServerSideSamplingStore.setFetching(true);

  promise
    .then(ServerSideSamplingStore.loadSamplingSdkVersionsSuccess)
    .catch(response => {
      const errorMessage = t('Unable to fetch sampling sdk versions');
      handleXhrErrorResponse(errorMessage)(response);
    })
    .finally(() => {
      ServerSideSamplingStore.setFetching(false);
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

  ServerSideSamplingStore.setFetching(true);

  const promise = api.requestPromise(
    `/projects/${orgSlug}/${projSlug}/dynamic-sampling/distribution/`
  );

  promise
    .then(ServerSideSamplingStore.loadSamplingDistributionSuccess)
    .catch(response => {
      const errorMessage = t('Unable to fetch sampling distribution');
      handleXhrErrorResponse(errorMessage)(response);
    })
    .finally(() => {
      ServerSideSamplingStore.setFetching(false);
    });

  return promise;
}
