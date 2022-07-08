import {useEffect, useMemo, useState} from 'react';

import {t} from 'sentry/locale';
import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';
import {Organization, Project} from 'sentry/types';
import {SamplingDistribution} from 'sentry/types/sampling';
import {defined} from 'sentry/utils';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';
import useProjects from 'sentry/utils/useProjects';

type Props = {
  orgSlug: Organization['slug'];
  projSlug: Project['slug'];
};

export function useRecommendedSdkUpgrades({orgSlug, projSlug}: Props) {
  const api = useApi();

  const [samplingDistribution, setSamplingDistribution] = useState<
    SamplingDistribution | undefined
  >(undefined);

  const [samplingSdkVersions, setSamplingSdkVersions] = useState(
    ServerSideSamplingStore.getState().samplingSdkVersions
  );

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

  const projectIds = useMemo(
    () =>
      samplingDistribution?.project_breakdown?.map(
        projectBreakdown => projectBreakdown.project_id
      ) ?? [],
    [samplingDistribution?.project_breakdown]
  );

  useEffect(() => {
    if (!projectIds.length) {
      return;
    }

    async function fetchSamplingSdkVersions() {
      try {
        ServerSideSamplingStore.reset();
        const response = await api.requestPromise(
          `/organizations/${orgSlug}/dynamic-sampling/sdk-versions/`,
          {
            method: 'GET',
            query: {
              project: projectIds,
            },
          }
        );
        ServerSideSamplingStore.loadSuccess(response);
        setSamplingSdkVersions(response);
      } catch (error) {
        const message = t('Unable to fetch sampling sdk versions');
        handleXhrErrorResponse(message)(error);
      }
    }
    fetchSamplingSdkVersions();
  }, [api, projSlug, orgSlug, projectIds]);

  const notSendingSampleRateSdkUpgrades =
    samplingSdkVersions?.filter(
      samplingSdkVersion => !samplingSdkVersion.isSendingSampleRate
    ) ?? [];

  const {projects} = useProjects({
    slugs: notSendingSampleRateSdkUpgrades.map(sdkUpgrade => sdkUpgrade.project),
    orgId: orgSlug,
  });

  const recommendedSdkUpgrades = projects
    .map(upgradeSDKfromProject => {
      const sdkInfo = notSendingSampleRateSdkUpgrades.find(
        notSendingSampleRateSdkUpgrade =>
          notSendingSampleRateSdkUpgrade.project === upgradeSDKfromProject.slug
      );

      if (!sdkInfo) {
        return undefined;
      }

      return {
        project: upgradeSDKfromProject,
        latestSDKName: sdkInfo.latestSDKName,
        latestSDKVersion: sdkInfo.latestSDKVersion,
      };
    })
    .filter(defined);

  return {
    recommendedSdkUpgrades,
  };
}
