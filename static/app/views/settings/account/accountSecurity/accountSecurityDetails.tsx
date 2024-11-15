/**
 * AccountSecurityDetails is only displayed when user is enrolled in the 2fa method.
 * It displays created + last used time of the 2fa method.
 *
 * Also displays 2fa method specific details.
 */
import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button, LinkButton} from 'sentry/components/button';
import CircleIndicator from 'sentry/components/circleIndicator';
import {DateTime} from 'sentry/components/dateTime';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Authenticator, AuthenticatorDevice} from 'sentry/types/auth';
import {useApiQuery, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import RecoveryCodes from 'sentry/views/settings/account/accountSecurity/components/recoveryCodes';
import RemoveConfirm from 'sentry/views/settings/account/accountSecurity/components/removeConfirm';
import U2fEnrolledDetails from 'sentry/views/settings/account/accountSecurity/components/u2fEnrolledDetails';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

const ENDPOINT = '/users/me/authenticators/';
const getAuthenticatorQueryKey = (authId: string) => [`${ENDPOINT}${authId}/`] as const;

interface AuthenticatorDateProps {
  /**
   * Can be null or a Date object.
   * Component will have value "never" if it is null
   */
  date: string | null;
  label: string;
}

function AuthenticatorDate({label, date}: AuthenticatorDateProps) {
  return (
    <Fragment>
      <DateLabel>{label}</DateLabel>
      <div>{date ? <DateTime date={date} /> : t('never')}</div>
    </Fragment>
  );
}

interface Props {
  deleteDisabled: boolean;
  onRegenerateBackupCodes: () => void;
}

function AccountSecurityDetails({deleteDisabled, onRegenerateBackupCodes}: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const {authId} = useParams<{authId: string}>();

  const {
    data: authenticator,
    isPending: isAuthenticatorPending,
    isError,
    refetch,
  } = useApiQuery<Authenticator>(getAuthenticatorQueryKey(authId), {
    staleTime: 0,
  });

  const {mutate: remove, isPending: isRemoveLoading} = useMutation({
    mutationFn: ({id, device}: {id: string; device?: AuthenticatorDevice}) => {
      // if the device is defined, it means that U2f is being removed
      // reason for adding a trailing slash is a result of the endpoint on line 109 needing it but it can't be set there as if deviceId is None, the route will end with '//'
      const deviceId = device ? `${device.key_handle}/` : '';
      return api.requestPromise(`${ENDPOINT}${id}/${deviceId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: (_, {device}) => {
      const deviceName = device ? device.name : t('Authenticator');
      addSuccessMessage(t('%s has been removed', deviceName));
    },
    onError: (_, {device}) => {
      const deviceName = device ? device.name : t('Authenticator');
      addErrorMessage(t('Error removing %s', deviceName));
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: getAuthenticatorQueryKey(authId)});
    },
  });

  const {mutate: rename, isPending: isRenameLoading} = useMutation({
    mutationFn: ({
      id,
      device,
      name,
    }: {
      device: AuthenticatorDevice;
      id: string;
      name: string;
    }) => {
      return api.requestPromise(`${ENDPOINT}${id}/${device.key_handle}/`, {
        method: 'PUT',
        data: {
          name,
        },
      });
    },
    onSuccess: () => {
      navigate(`/settings/account/security/mfa/${authId}`);
      addSuccessMessage(t('Device was renamed'));
    },
    onError: () => {
      addErrorMessage(t('Error renaming the device'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: getAuthenticatorQueryKey(authId)});
    },
  });

  const handleRemove = (device?: AuthenticatorDevice) => {
    if (!authenticator?.authId) {
      return;
    }
    remove({id: authenticator.authId, device});
  };

  const handleRename = (device: AuthenticatorDevice, deviceName: string) => {
    if (!authenticator?.authId) {
      return;
    }
    rename({id: authenticator.authId, device, name: deviceName});
  };

  if (isAuthenticatorPending || isRemoveLoading || isRenameLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <SentryDocumentTitle title={t('Security')}>
      <SettingsPageHeader
        title={
          <Fragment>
            <span>{authenticator.name}</span>
            <AuthenticatorStatus
              data-test-id={`auth-status-${
                authenticator.isEnrolled ? 'enabled' : 'disabled'
              }`}
              enabled={authenticator.isEnrolled}
            />
          </Fragment>
        }
        action={
          <AuthenticatorActions>
            {authenticator.isEnrolled && authenticator.allowRotationInPlace && (
              <LinkButton
                to={`/settings/account/security/mfa/${authenticator.id}/enroll/`}
              >
                {t('Rotate Secret Key')}
              </LinkButton>
            )}
            {authenticator.isEnrolled && authenticator.removeButton && (
              <Tooltip
                title={t(
                  "Two-factor authentication is required for at least one organization you're a member of."
                )}
                disabled={!deleteDisabled}
              >
                <RemoveConfirm onConfirm={handleRemove} disabled={deleteDisabled}>
                  <Button priority="danger">{authenticator.removeButton}</Button>
                </RemoveConfirm>
              </Tooltip>
            )}
          </AuthenticatorActions>
        }
      />

      <TextBlock>{authenticator.description}</TextBlock>

      <AuthenticatorDates>
        <AuthenticatorDate label={t('Created at')} date={authenticator.createdAt} />
        <AuthenticatorDate label={t('Last used')} date={authenticator.lastUsedAt} />
      </AuthenticatorDates>

      <U2fEnrolledDetails
        isEnrolled={authenticator.isEnrolled}
        id={authenticator.id}
        devices={authenticator.devices}
        onRemoveU2fDevice={handleRemove}
        onRenameU2fDevice={handleRename}
      />

      {authenticator.isEnrolled && authenticator.phone && (
        <PhoneWrapper>
          {t('Confirmation codes are sent to the following phone number')}:
          <Phone>{authenticator.phone}</Phone>
        </PhoneWrapper>
      )}

      <RecoveryCodes
        onRegenerateBackupCodes={onRegenerateBackupCodes}
        isEnrolled={authenticator.isEnrolled}
        codes={authenticator.codes}
      />
    </SentryDocumentTitle>
  );
}

export default AccountSecurityDetails;

const AuthenticatorStatus = styled(CircleIndicator)`
  margin-left: ${space(1)};
`;

const AuthenticatorActions = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;

  > * {
    margin-left: ${space(1)};
  }
`;

const AuthenticatorDates = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-template-columns: max-content auto;
`;

const DateLabel = styled('span')`
  font-weight: ${p => p.theme.fontWeightBold};
`;

const PhoneWrapper = styled('div')`
  margin-top: ${space(4)};
`;

const Phone = styled('span')`
  font-weight: ${p => p.theme.fontWeightBold};
  margin-left: ${space(1)};
`;
