import {Fragment, useState} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd, IconFlag} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Project, ProjectKey} from 'sentry/types/project';
import {useApiQuery, useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

import KeyRow from './keyRow';

type Props = {
  project: Project;
};

function ProjectKeys({project}: Props) {
  const params = useParams<{projectId: string}>();
  const {projectId} = params;
  const location = useLocation();
  const organization = useOrganization();
  const api = useApi({persistInFlight: true});
  const routes = useRoutes();

  const [keyListState, setKeyListState] = useState<ProjectKey[] | undefined>(undefined);

  const {
    data: fetchedKeyList,
    isPending,
    isError,
    refetch,
    getResponseHeader,
  } = useApiQuery<ProjectKey[]>([`/projects/${organization.slug}/${projectId}/keys/`], {
    staleTime: 0,
  });

  /**
   * Optimistically remove key
   */
  const handleRemoveKeyMutation = useMutation({
    mutationFn: (data: ProjectKey) => {
      return api.requestPromise(
        `/projects/${organization.slug}/${projectId}/keys/${data.id}/`,
        {
          method: 'DELETE',
        }
      );
    },
    onMutate: (data: ProjectKey) => {
      addLoadingMessage(t('Revoking key\u2026'));
      setKeyListState(keyList.filter(key => key.id !== data.id));
    },
    onSuccess: () => {
      addSuccessMessage(t('Revoked key'));
    },
    onError: () => {
      setKeyListState([...keyList]);
      addErrorMessage(t('Unable to revoke key'));
    },
  });

  const handleToggleKeyMutation = useMutation({
    mutationFn: ({isActive, data}: {data: ProjectKey; isActive: boolean}) => {
      return api.requestPromise(
        `/projects/${organization.slug}/${projectId}/keys/${data.id}/`,
        {
          method: 'PUT',
          data: {isActive},
        }
      );
    },
    onMutate: ({data}: {data: ProjectKey}) => {
      addLoadingMessage(t('Saving changes\u2026'));
      setKeyListState(
        keyList.map(key => {
          if (key.id === data.id) {
            return {
              ...key,
              isActive: !data.isActive,
            };
          }

          return key;
        })
      );
    },
    onSuccess: ({isActive}: {isActive: boolean}) => {
      addSuccessMessage(isActive ? t('Enabled key') : t('Disabled key'));
    },
    onError: ({isActive}: {isActive: boolean}) => {
      addErrorMessage(isActive ? t('Error enabling key') : t('Error disabling key'));
      setKeyListState([...keyList]);
    },
  });

  const handleCreateKeyMutation = useMutation({
    mutationFn: () => {
      return api.requestPromise(`/projects/${organization.slug}/${projectId}/keys/`, {
        method: 'POST',
      });
    },
    onSuccess: (updatedKey: ProjectKey) => {
      setKeyListState([...keyList, updatedKey]);
      addSuccessMessage(t('Created a new key.'));
    },
    onError: () => {
      addErrorMessage(t('Unable to create new key. Please try again.'));
    },
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const keyList = keyListState ? keyListState : fetchedKeyList;

  const renderEmpty = () => {
    return (
      <Panel>
        <EmptyMessage
          icon={<IconFlag size="xl" />}
          description={t('There are no keys active for this project.')}
        />
      </Panel>
    );
  };

  const renderResults = () => {
    const hasAccess = hasEveryAccess(['project:write'], {organization, project});

    return (
      <Fragment>
        {keyList.map(key => (
          <KeyRow
            hasWriteAccess={hasAccess}
            key={key.id}
            orgId={organization.slug}
            projectId={projectId}
            project={project}
            data={key}
            onToggle={(isActive, data) =>
              handleToggleKeyMutation.mutate({isActive, data})
            }
            onRemove={data => handleRemoveKeyMutation.mutate(data)}
            routes={routes}
            location={location}
            params={params}
          />
        ))}
        <Pagination pageLinks={getResponseHeader?.('Link')} />
      </Fragment>
    );
  };

  const isEmpty = !keyList.length;
  const hasAccess = hasEveryAccess(['project:write'], {organization, project});

  return (
    <div data-test-id="project-keys">
      <SentryDocumentTitle title={t('Client Keys')} projectSlug={project.slug} />
      <SettingsPageHeader
        title={t('Client Keys')}
        action={
          <Button
            onClick={() => handleCreateKeyMutation.mutate()}
            size="sm"
            priority="primary"
            icon={<IconAdd isCircled />}
            disabled={!hasAccess}
          >
            {t('Generate New Key')}
          </Button>
        }
      />

      <TextBlock>
        {tct(
          `To send data to Sentry you will need to configure an SDK with a client key
          (usually referred to as the [code:SENTRY_DSN] value). For more
          information on integrating Sentry with your application take a look at our
          [link:documentation].`,
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platform-redirect/?next=/configuration/options/" />
            ),
            code: <code />,
          }
        )}
      </TextBlock>

      <ProjectPermissionAlert margin={false} project={project} />

      {isEmpty ? renderEmpty() : renderResults()}
    </div>
  );
}

export default ProjectKeys;
