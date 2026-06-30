import {useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Flex, Stack} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {BuildError} from 'sentry/views/preprod/components/buildError';

type LatestBaseSnapshotResponse = {
  head_artifact_id: string;
};

export default function LatestBaseSnapshotResolver() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {projectId, appId} = useParams<{appId: string; projectId: string}>();

  const {data, isError} = useQuery({
    ...apiOptions.as<LatestBaseSnapshotResponse>()(
      '/organizations/$organizationIdOrSlug/preprodartifacts/snapshots/latest-base/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {app_id: appId, project: projectId},
        staleTime: 0,
      }
    ),
    retry: (count, err) =>
      count < 3 && (!(err instanceof RequestError) || (err.status ?? 0) >= 500),
  });

  useEffect(() => {
    if (!data) {
      return;
    }
    const {customerDomain} = ConfigStore.getState();
    const orgPrefix = customerDomain ? '' : `/organizations/${organization.slug}`;
    navigate(`${orgPrefix}/preprod/snapshots/${data.head_artifact_id}/`, {replace: true});
  }, [data, navigate, organization.slug]);

  if (isError) {
    return (
      <SentryDocumentTitle title={t('Snapshot')}>
        <Stack flex={1}>
          <BuildError
            title={t('No base snapshot found')}
            message={t(
              'We could not find a base snapshot for this app. It may not have been uploaded yet, or you may not have access to it.'
            )}
          />
        </Stack>
      </SentryDocumentTitle>
    );
  }

  return (
    <SentryDocumentTitle title={t('Snapshot')}>
      <Stack flex={1}>
        <Flex align="center" justify="center" padding="3xl">
          <LoadingIndicator />
        </Flex>
      </Stack>
    </SentryDocumentTitle>
  );
}
