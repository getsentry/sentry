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
  projects,
  statsPeriod,
}: {
  api: Client;
  orgSlug: Organization['slug'];
  projectID?: Project['id']; // TODO: Remove conditional on this when projects is removed.
  projects?: number[]; // TODO: Remove this later since we do not need this for source check in the long term.
  statsPeriod?: string;
}): Promise<SamplingSdkVersion[]> {
  const {samplingDistribution} = ServerSideSamplingStore.getState();

  const projectIds = projects ?? [
    projectID,
    ...(samplingDistribution.project_breakdown?.map(
      projectBreakdown => projectBreakdown.project_id
    ) ?? []),
  ];

  const promise = api.requestPromise(
    `/organizations/${orgSlug}/dynamic-sampling/sdk-versions/`,
    {
      query: {
        project: projectIds,
        statsPeriod: statsPeriod ?? '24h',
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
    })
    .finally(() => {
      ServerSideSamplingStore.setFetching(false);
    });

  return promise;
}
