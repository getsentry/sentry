/**
 * AccountSecurityDetails is only displayed when user is enrolled in the 2fa method.
 * It displays created + last used time of the 2fa method.
 *
 * Also displays 2fa method specific details.
 */
import {Fragment} from 'react';
import styled from '@emotion/styled';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex, Grid, Container} from '@sentry/scraps/layout';
import {toast} from '@sentry/scraps/toast';

import {DateTime} from 'sentry/components/dateTime';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Authenticator, AuthenticatorDevice} from 'sentry/types/auth';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {TextBlock} from 'sentry/views/settings/components/text/textBlock';

import {RecoveryCodes} from './components/recoveryCodes';
import {RemoveConfirm} from './components/removeConfirm';
import U2fEnrolledDetails from './components/u2fEnrolledDetails';
import {useAccountSecurityContext} from './accountSecurityWrapper';

const ENDPOINT = '/users/me/authenticators/';
const authenticatorOptions = (authId: string) =>
  apiOptions.as<Authenticator>()('/users/$userId/authenticators/$authId/', {
    path: {userId: 'me', authId},
    staleTime: 0,
  });

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

export default function AccountSecurityDetails() {
  const {deleteDisabled, onRegenerateBackupCodes} = useAccountSecurityContext();
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const {authId} = useParams<{authId: string}>();

  const {
    data: authenticator,
    isPending: isAuthenticatorPending,
    isError,
    refetch,
  } = useQuery(authenticatorOptions(authId));

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
      toast.success(t('%s has been removed', deviceName));
    },
    onError: (_, {device}) => {
      const deviceName = device ? device.name : t('Authenticator');
      toast.error(t('Error removing %s', deviceName));
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: authenticatorOptions(authId).queryKey});
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
      toast.success(t('Device was renamed'));
    },
    onError: () => {
      toast.error(t('Error renaming the device'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: authenticatorOptions(authId).queryKey});
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
        title={authenticator.name}
        action={
          <Flex gap="md">
            {authenticator.isEnrolled && authenticator.allowRotationInPlace && (
              <LinkButton
                to={`/settings/account/security/mfa/${authenticator.id}/enroll/`}
              >
                {t('Rotate Secret Key')}
              </LinkButton>
            )}
            {authenticator.isEnrolled && authenticator.removeButton && (
              <RemoveConfirm onConfirm={handleRemove} disabled={deleteDisabled}>
                <Button
                  tooltipProps={{
                    title: deleteDisabled
                      ? t(
                          "Two-factor authentication is required for at least one organization you're a member of."
                        )
                      : undefined,
                  }}
                  variant="danger"
                >
                  {authenticator.removeButton}
                </Button>
              </RemoveConfirm>
            )}
          </Flex>
        }
      />

      <TextBlock>{authenticator.description}</TextBlock>

      <Grid gap="sm xl" columns="max-content auto">
        <AuthenticatorDate label={t('Created at')} date={authenticator.createdAt} />
        <AuthenticatorDate label={t('Last used')} date={authenticator.lastUsedAt} />
      </Grid>

      <U2fEnrolledDetails
        isEnrolled={authenticator.isEnrolled}
        id={authenticator.id}
        devices={authenticator.devices}
        onRemoveU2fDevice={handleRemove}
        onRenameU2fDevice={handleRename}
      />

      {authenticator.isEnrolled && authenticator.phone && (
        <Container marginTop="3xl">
          {t('Confirmation codes are sent to the following phone number')}:
          <Phone>{authenticator.phone}</Phone>
        </Container>
      )}

      <RecoveryCodes
        onRegenerateBackupCodes={onRegenerateBackupCodes}
        isEnrolled={authenticator.isEnrolled}
        codes={authenticator.codes}
      />
    </SentryDocumentTitle>
  );
}

const DateLabel = styled('span')`
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;

const Phone = styled('span')`
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin-left: ${p => p.theme.space.md};
`;
