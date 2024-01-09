import {browserHistory, RouteComponentProps} from 'react-router';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {Organization, Project, ProjectKey} from 'sentry/types';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import RouteError from 'sentry/views/routeError';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';
import {KeySettings} from 'sentry/views/settings/project/projectKeys/details/keySettings';
import KeyStats from 'sentry/views/settings/project/projectKeys/details/keyStats';

type Props = {
  organization: Organization;
  project: Project;
} & RouteComponentProps<
  {
    keyId: string;
    projectId: string;
  },
  {}
>;

export default function ProjectKeyDetails({organization, params, project}: Props) {
  const {keyId, projectId} = params;
  const api = useApi();
  const queryClient = useQueryClient();

  const {
    data: projKeyData,
    isError,
    isLoading,
  } = useApiQuery<ProjectKey>(
    [`/projects/${organization.slug}/${projectId}/keys/${keyId}/`],
    {staleTime: 0}
  );

  function onDataChange(data: ProjectKey) {
    setApiQueryData<ProjectKey>(
      queryClient,
      [`/projects/${organization.slug}/${projectId}/keys/${keyId}/`],
      oldData => {
        return {...oldData, data};
      }
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

  if (isLoading) {
    return <LoadingIndicator />;
  }

  return (
    <SentryDocumentTitle title={t('Key Details')}>
      <SettingsPageHeader title={t('Key Details')} data-test-id="key-details" />
      <PermissionAlert project={project} />
      <KeyStats api={api} organization={organization} params={params} />
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
