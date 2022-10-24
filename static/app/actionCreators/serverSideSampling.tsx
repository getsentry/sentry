import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';
import {Organization, Project, SeriesApi} from 'sentry/types';
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
  const sdkVersions = ServerSideSamplingStore.getState().sdkVersions.data;

  if (sdkVersions !== undefined) {
    return new Promise(resolve => resolve(sdkVersions));
  }

  const distribution = ServerSideSamplingStore.getState().distribution.data;

  const {startTimestamp, endTimestamp, projectBreakdown} = distribution ?? {};

  ServerSideSamplingStore.sdkVersionsRequestLoading();

  if (!startTimestamp || !endTimestamp) {
    ServerSideSamplingStore.sdkVersionsRequestSuccess([]);
    return new Promise(resolve => resolve([]));
  }

  const projectIds = [
    projectID,
    ...(projectBreakdown?.map(projectBreakdownObj => projectBreakdownObj.projectId) ??
      []),
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

  promise.then(ServerSideSamplingStore.sdkVersionsRequestSuccess).catch(response => {
    const errorMessage = t('Unable to fetch sampling sdk versions');
    handleXhrErrorResponse(errorMessage)(response);
    ServerSideSamplingStore.sdkVersionsRequestError(errorMessage);
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
  const distribution = ServerSideSamplingStore.getState().distribution.data;

  if (distribution !== undefined) {
    return new Promise(resolve => resolve(distribution));
  }

  ServerSideSamplingStore.distributionRequestLoading();

  const promise = api.requestPromise(
    `/projects/${orgSlug}/${projSlug}/dynamic-sampling/distribution/`
  );

  promise.then(ServerSideSamplingStore.distributionRequestSuccess).catch(response => {
    const errorMessage = t('Unable to fetch sampling distribution');
    handleXhrErrorResponse(errorMessage)(response);
    ServerSideSamplingStore.distributionRequestError(errorMessage);
  });

  return promise;
}

function fetchProjectStats48h({
  api,
  orgSlug,
  projId,
}: {
  api: Client;
  orgSlug: Organization['slug'];
  projId?: Project['id'];
}) {
  ServerSideSamplingStore.projectStats48hRequestLoading();

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

  promise.then(ServerSideSamplingStore.projectStats48hRequestSuccess).catch(response => {
    const errorMessage = t('Unable to fetch project stats from the last 48 hours');
    handleXhrErrorResponse(errorMessage)(response);
    ServerSideSamplingStore.projectStats48hRequestError(errorMessage);
  });

  return promise;
}

function fetchProjectStats30d({
  api,
  orgSlug,
  projId,
}: {
  api: Client;
  orgSlug: Organization['slug'];
  projId?: Project['id'];
}) {
  ServerSideSamplingStore.projectStats30dRequestLoading();

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

  promise.then(ServerSideSamplingStore.projectStats30dRequestSuccess).catch(response => {
    const errorMessage = t('Unable to fetch project stats from the last 30 days');
    handleXhrErrorResponse(errorMessage)(response);
    ServerSideSamplingStore.projectStats30dRequestError(errorMessage);
  });

  return promise;
}

export function fetchProjectStats(props: {
  api: Client;
  orgSlug: Organization['slug'];
  projId?: Project['id'];
}): Promise<[SeriesApi, SeriesApi]> {
  const projectStats48h = ServerSideSamplingStore.getState().projectStats48h.data;
  const projectStats30d = ServerSideSamplingStore.getState().projectStats30d.data;

  if (projectStats48h !== undefined && projectStats30d !== undefined) {
    return new Promise(resolve => resolve([projectStats48h, projectStats30d]));
  }

  ServerSideSamplingStore.reset();

  return Promise.all([fetchProjectStats48h(props), fetchProjectStats30d(props)]);
}
