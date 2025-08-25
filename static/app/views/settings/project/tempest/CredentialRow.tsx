import {Fragment} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Confirm from 'sentry/components/confirm';
import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TimeSince from 'sentry/components/timeSince';
import {IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';

import {MessageType, type TempestCredentials} from './types';

type CredentialRowProps = {
  credential: TempestCredentials;
  hasWriteAccess: boolean;
  onRemoveCredentialSuccess: () => void;
  project: Project;
};

export function CredentialRow({
  credential,
  project,
  onRemoveCredentialSuccess,
  hasWriteAccess,
}: CredentialRowProps) {
  const organization = useOrganization();

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
      onRemoveCredentialSuccess();
    },
    onError: error => {
      const message = t('Failed to remove the credentials.');
      handleXhrErrorResponse(message, error);
      addErrorMessage(message);
    },
  });

  return (
    <Fragment>
      <Flex align="center" gap="md">
        {credential.clientId}
      </Flex>

      <Flex align="center">
        <StatusTag statusType={getStatusType(credential)} message={credential.message} />
      </Flex>

      <Flex align="center">
        <TimeSince date={credential.dateAdded} />
      </Flex>

      <Flex align="center">
        {credential.createdByEmail ? credential.createdByEmail : '\u2014'}
      </Flex>

      <Flex align="center" justify="end">
        <Tooltip
          title={t('You must be an organization admin to remove credentials.')}
          disabled={!!hasWriteAccess}
        >
          <Confirm
            message={t('Are you sure you want to remove the credentials?')}
            onConfirm={
              hasWriteAccess
                ? () => handleRemoveCredential({id: credential.id})
                : undefined
            }
            disabled={isRemoving || !hasWriteAccess}
          >
            <Button
              size="xs"
              disabled={isRemoving || !hasWriteAccess}
              aria-label={t('Remove credentials')}
              icon={
                isRemoving ? (
                  <LoadingIndicator mini />
                ) : (
                  <IconSubtract isCircled size="xs" />
                )
              }
            >
              {t('Remove')}
            </Button>
          </Confirm>
        </Tooltip>
      </Flex>
    </Fragment>
  );
}

type StatusTagProps = {
  statusType: 'error' | 'success' | 'pending';
  message?: string;
};

const STATUS_CONFIG = {
  error: {label: 'Error', type: 'error'},
  success: {label: 'Active', type: 'default'},
  pending: {label: 'Pending', type: 'info'},
} as const;

function StatusTag({statusType, message}: StatusTagProps) {
  const config = STATUS_CONFIG[statusType];
  return (
    <Tooltip title={message} skipWrapper>
      <Tag type={config.type}>{config.label}</Tag>
    </Tooltip>
  );
}

function getStatusType(credential: {
  message: TempestCredentials['message'];
  messageType: TempestCredentials['messageType'];
}) {
  if (credential.messageType === null) {
    // If messageType is null, it is pending and still it wasn't validated
    return 'pending';
  }

  return credential.messageType === MessageType.ERROR ? 'error' : 'success';
}
