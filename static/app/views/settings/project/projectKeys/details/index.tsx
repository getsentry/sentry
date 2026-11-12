import {useQuery, useQueryClient} from '@tanstack/react-query';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {ProjectKey} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {RouteError} from 'sentry/views/routeError';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {RelayDsnOverrideAlert} from 'sentry/views/settings/project/projectKeys/relayDsnOverrideAlert';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {KeySettings} from './keySettings';
import {KeyStats} from './keyStats';

export default function ProjectKeyDetails() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const params = useParams<{keyId: string; projectId: string}>();
  const {keyId, projectId} = params;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const projectKeyOptions = apiOptions.as<ProjectKey>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/keys/$keyId/',
    {
      path: {
        organizationIdOrSlug: organization.slug,
        projectIdOrSlug: projectId,
        keyId,
      },
      staleTime: 0,
    }
  );
  const {data: projKeyData, isError, isPending} = useQuery(projectKeyOptions);

  function onDataChange(data: ProjectKey) {
    queryClient.setQueryData(projectKeyOptions.queryKey, previous => ({
      json: data,
      headers: previous?.headers ?? {},
    }));
  }

  const handleRemove = () => {
    navigate(normalizeUrl(`/settings/${organization.slug}/projects/${projectId}/keys/`));
  };

  if (isError) {
    return <RouteError />;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  return (
    <SentryDocumentTitle title={t('Key Details')}>
      <div data-test-id="key-details">
        <SettingsPageHeader title={t('Key Details')} />
        <ProjectPermissionAlert project={project} />
        <RelayDsnOverrideAlert />
        <KeyStats />
        <KeySettings
          data={projKeyData}
          updateData={onDataChange}
          onRemove={handleRemove}
          organization={organization}
          project={project}
          params={params}
        />
      </div>
    </SentryDocumentTitle>
  );
}
