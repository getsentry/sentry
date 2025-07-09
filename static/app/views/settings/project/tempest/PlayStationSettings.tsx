import {Fragment, useEffect, useMemo} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openAddTempestCredentialsModal} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Tooltip} from 'sentry/components/core/tooltip';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Panel from 'sentry/components/panels/panel';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useFetchTempestCredentials} from 'sentry/views/settings/project/tempest/hooks/useFetchTempestCredentials';
import {MessageType} from 'sentry/views/settings/project/tempest/types';
import {useHasTempestWriteAccess} from 'sentry/views/settings/project/tempest/utils/access';

import {CredentialRow} from './CredentialRow';
import EmptyState from './EmptyState';
import {RequestSdkAccessButton} from './RequestSdkAccessButton';

interface Props {
  organization: Organization;
  project: Project;
}

export default function PlayStationSettings({organization, project}: Props) {
  const hasWriteAccess = useHasTempestWriteAccess();
  const {
    data: tempestCredentials,
    isLoading,
    invalidateCredentialsCache,
  } = useFetchTempestCredentials(organization, project);

  const {mutate: handleRemoveCredential, isPending: isRemoving} = useMutation<
    unknown,
    RequestError,
    {id: number}
  >({
    mutationFn: ({id}) =>
      fetchMutation([
        'DELETE',
        `/projects/${organization.slug}/${project.slug}/tempest-credentials/${id}/`,
      ]),
    onSuccess: () => {
      addSuccessMessage(t('Removed the credentials.'));
      trackAnalytics('tempest.credentials.removed', {
        organization,
        project_slug: project.slug,
      });
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

  useEffect(() => {
    if (credentialErrors && credentialErrors.length > 0) {
      trackAnalytics('tempest.credentials.error_displayed', {
        organization,
        project_slug: project.slug,
        error_count: credentialErrors.length,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentialErrors]);

  const isEmpty = !tempestCredentials?.length;

  return (
    <Fragment>
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

      {!isLoading && isEmpty ? (
        <Panel>
          <EmptyState />
        </Panel>
      ) : (
        <PanelTable
          headers={[t('Client ID'), t('Status'), t('Created At'), t('Created By'), '']}
          isLoading={isLoading}
          isEmpty={isEmpty}
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
      )}
    </Fragment>
  );
}

export const getPlayStationHeaderAction = (
  hasWriteAccess: boolean,
  organization: Organization,
  project: Project
) => (
  <Fragment>
    <ButtonBar gap={1.5}>
      <FeedbackWidgetButton />
      <RequestSdkAccessButton organization={organization} project={project} />
      <Tooltip
        title={t('You must be an organization admin to add new credentials.')}
        disabled={hasWriteAccess}
      >
        <Button
          priority="primary" redesign
          size="sm"
          data-test-id="create-new-credentials"
          disabled={!hasWriteAccess}
          icon={<IconAdd isCircled redesign />}
          onClick={() => {
            openAddTempestCredentialsModal({organization, project});
            trackAnalytics('tempest.credentials.add_modal_opened', {
              organization,
              project_slug: project.slug,
            });
          }}
        >
          {t('Add Credentials')}
        </Button>
      </Tooltip>
    </ButtonBar>
  </Fragment>
);
