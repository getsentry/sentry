import {Fragment, useEffect, useMemo} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Alert} from 'sentry/components/core/alert';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Panel from 'sentry/components/panels/panel';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {AddCredentialsButton} from 'sentry/views/settings/project/tempest/addCredentialsButton';
import {ConfigForm} from 'sentry/views/settings/project/tempest/configForm';
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
      fetchMutation({
        method: 'DELETE',
        url: `/projects/${organization.slug}/${project.slug}/tempest-credentials/${id}/`,
      }),
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
          <Alert type="error">
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

      <ConfigForm organization={organization} project={project} />

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
  organization: Organization,
  project: Project
) => (
  <Fragment>
    <ButtonBar gap="lg">
      <FeedbackWidgetButton />
      <RequestSdkAccessButton organization={organization} project={project} />
      <AddCredentialsButton project={project} />
    </ButtonBar>
  </Fragment>
);
