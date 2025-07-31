import {useTheme} from '@emotion/react';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project, ProjectKey} from 'sentry/types/project';
import {browserHistory} from 'sentry/utils/browserHistory';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import RouteError from 'sentry/views/routeError';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {KeySettings} from 'sentry/views/settings/project/projectKeys/details/keySettings';
import KeyStats from 'sentry/views/settings/project/projectKeys/details/keyStats';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

type Props = {
  organization: Organization;
  project: Project;
} & RouteComponentProps<{
  keyId: string;
  projectId: string;
}>;

export default function ProjectKeyDetails({organization, params, project}: Props) {
  const {keyId, projectId} = params;
  const api = useApi();
  const queryClient = useQueryClient();
  const theme = useTheme();

  const {
    data: projKeyData,
    isError,
    isPending,
  } = useApiQuery<ProjectKey>(
    [`/projects/${organization.slug}/${projectId}/keys/${keyId}/`],
    {staleTime: 0}
  );

  function onDataChange(data: ProjectKey) {
    setApiQueryData<ProjectKey>(
      queryClient,
      [`/projects/${organization.slug}/${projectId}/keys/${keyId}/`],
      data
    );
  }

  const handleRemove = () => {
    browserHistory.push(
      normalizeUrl(`/settings/${organization.slug}/projects/${projectId}/keys/`)
    );
  };

  if (isError) {
    return <RouteError />;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  return (
    <SentryDocumentTitle title={t('Key Details')}>
      <SettingsPageHeader title={t('Key Details')} data-test-id="key-details" />
      <ProjectPermissionAlert project={project} />
      <KeyStats api={api} organization={organization} params={params} theme={theme} />
      <KeySettings
        data={projKeyData}
        updateData={onDataChange}
        onRemove={handleRemove}
        organization={organization}
        project={project}
        params={params}
      />
    </SentryDocumentTitle>
  );
}
