import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';
import {Organization, Project} from 'sentry/types';
import {SamplingDistribution, SamplingSdkVersion} from 'sentry/types/sampling';
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
  const {distribution} = ServerSideSamplingStore.getState();
  const {startTimestamp, endTimestamp, project_breakdown} = distribution.data ?? {};

  ServerSideSamplingStore.fetchSdkVersions();

  if (!startTimestamp || !endTimestamp) {
    ServerSideSamplingStore.fetchSdkVersionsSuccess([]);
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

  promise.then(ServerSideSamplingStore.fetchSdkVersionsSuccess).catch(response => {
    const errorMessage = t('Unable to fetch sampling sdk versions');
    handleXhrErrorResponse(errorMessage)(response);
    ServerSideSamplingStore.fetchSdkVersionsError(errorMessage);
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

  ServerSideSamplingStore.fetchDistribution();

  const promise = api.requestPromise(
    `/projects/${orgSlug}/${projSlug}/dynamic-sampling/distribution/`
  );

  promise.then(ServerSideSamplingStore.fetchDistributionSuccess).catch(response => {
    const errorMessage = t('Unable to fetch sampling distribution');
    handleXhrErrorResponse(errorMessage)(response);
    ServerSideSamplingStore.fetchDistributionError(errorMessage);
  });

  return promise;
}

export function fetchProjectStats48h({
  api,
  orgSlug,
  projId,
}: {
  api: Client;
  orgSlug: Organization['slug'];
  projId?: Project['id'];
}) {
  ServerSideSamplingStore.fetchProjectStats48h();

  const promise = api.requestPromise(`/organizations/${orgSlug}/stats_v2/`, {
    query: {
      project: projId,
      category: 'transaction',
      field: 'sum(quantity)',
      interval: '1h',
      statsPeriod: '48h',
      groupBy: 'outcome',
    },
  });

  promise.then(ServerSideSamplingStore.fetchProjectStats48hSuccess).catch(response => {
    const errorMessage = t('Unable to fetch project stats from the last 48 hours');
    handleXhrErrorResponse(errorMessage)(response);
    ServerSideSamplingStore.fetchProjectStats48hError(errorMessage);
  });

  return promise;
}

export function fetchProjectStats30d({
  api,
  orgSlug,
  projId,
}: {
  api: Client;
  orgSlug: Organization['slug'];
  projId?: Project['id'];
}) {
  ServerSideSamplingStore.fetchProjectStats30d();

  const promise = api.requestPromise(`/organizations/${orgSlug}/stats_v2/`, {
    query: {
      project: projId,
      category: 'transaction',
      field: 'sum(quantity)',
      interval: '1d',
      statsPeriod: '30d',
      groupBy: ['outcome', 'reason'],
    },
  });

  promise.then(ServerSideSamplingStore.fetchProjectStats30dSuccess).catch(response => {
    const errorMessage = t('Unable to fetch project stats from the last 30 days');
    handleXhrErrorResponse(errorMessage)(response);
    ServerSideSamplingStore.fetchProjectStats30dError(errorMessage);
  });

  return promise;
}
