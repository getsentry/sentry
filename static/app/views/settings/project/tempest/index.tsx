import {Fragment, useMemo} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openAddTempestCredentialsModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {Alert} from 'sentry/components/core/alert';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {PanelTable} from 'sentry/components/panels/panelTable';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {hasTempestAccess} from 'sentry/utils/tempest/features';
import useApi from 'sentry/utils/useApi';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {useFetchTempestCredentials} from 'sentry/views/settings/project/tempest/hooks/useFetchTempestCredentials';
import {MessageType} from 'sentry/views/settings/project/tempest/types';
import {useHasTempestWriteAccess} from 'sentry/views/settings/project/tempest/utils/access';

import {CredentialRow} from './CredentialRow';

interface Props {
  organization: Organization;
  project: Project;
}

export default function TempestSettings({organization, project}: Props) {
  const hasWriteAccess = useHasTempestWriteAccess();
  const {
    data: tempestCredentials,
    isLoading,
    invalidateCredentialsCache,
  } = useFetchTempestCredentials(organization, project);

  const api = useApi();
  const {mutate: handleRemoveCredential, isPending: isRemoving} = useMutation<
    unknown,
    RequestError,
    {id: number}
  >({
    mutationFn: ({id}) =>
      api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/tempest-credentials/${id}/`,
        {
          method: 'DELETE',
        }
      ),
    onSuccess: () => {
      addSuccessMessage(t('Removed the credentials.'));
      invalidateCredentialsCache();
    },
    onError: error => {
      const message = t('Failed to remove the credentials.');
      handleXhrErrorResponse(message, error);
      addErrorMessage(message);
    },
  });

  const credentialErrors = useMemo(() => {
    return tempestCredentials?.filter(
      credential => credential.messageType === MessageType.ERROR && credential.message
    );
  }, [tempestCredentials]);

  if (!hasTempestAccess(organization)) {
    return (
      <Alert.Container>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </Alert.Container>
    );
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('PlayStation')} />
      <SettingsPageHeader
        title={t('PlayStation')}
        action={addNewCredentials(hasWriteAccess, organization, project)}
      />

      {credentialErrors && credentialErrors?.length > 0 && (
        <Alert.Container>
          <Alert type="error" showIcon>
            {t('There was a problem with following credentials:')}
            <List symbol="bullet">
              {credentialErrors.map(credential => (
                <ListItem key={credential.id}>
                  {credential.clientId} - {credential.message}
                </ListItem>
              ))}
            </List>
          </Alert>
        </Alert.Container>
      )}

      <Form
        apiMethod="PUT"
        apiEndpoint={`/projects/${organization.slug}/${project.slug}/`}
        initialData={{
          tempestFetchScreenshots: project?.tempestFetchScreenshots,
          tempestFetchDumps: project?.tempestFetchDumps,
        }}
        saveOnBlur
        hideFooter
      >
        <JsonForm
          forms={[
            {
              title: t('General Settings'),
              fields: [
                {
                  name: 'tempestFetchScreenshots',
                  type: 'boolean',
                  label: t('Attach Screenshots'),
                  help: t('Attach screenshots to issues.'),
                },
                {
                  name: 'tempestFetchDumps',
                  type: 'boolean',
                  label: t('Attach Dumps'),
                  help: t('Attach dumps to issues.'),
                },
              ],
            },
          ]}
        />
      </Form>

      <PanelTable
        headers={[
          t('Client ID'),
          t('Client Secret'),
          t('Created At'),
          t('Created By'),
          '',
        ]}
        isLoading={isLoading}
        isEmpty={!tempestCredentials?.length}
      >
        {tempestCredentials?.map(credential => (
          <CredentialRow
            key={credential.id}
            credential={credential}
            isRemoving={isRemoving}
            removeCredential={hasWriteAccess ? handleRemoveCredential : undefined}
          />
        ))}
      </PanelTable>
    </Fragment>
  );
}

const addNewCredentials = (
  hasWriteAccess: boolean,
  organization: Organization,
  project: Project
) => (
  <Tooltip
    title={t('You must be an organization admin to add new credentials.')}
    disabled={hasWriteAccess}
  >
    <Button
      priority="primary"
      size="sm"
      data-test-id="create-new-credentials"
      disabled={!hasWriteAccess}
      onClick={() => openAddTempestCredentialsModal({organization, project})}
    >
      {t('Add Credentials')}
    </Button>
  </Tooltip>
);
