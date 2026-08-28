import {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {TextCopyInput} from 'sentry/components/textCopyInput';
import {IconAdd, IconDelete, IconEdit, IconLock} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Team} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {
  type ServiceAccount,
  serviceAccountsQueryOptions,
  serviceAccountTokenUrl,
  serviceAccountUrl,
} from './api';
import {
  CreateServiceAccountForm,
  CreateServiceAccountTokenForm,
  EditServiceAccountForm,
} from './forms';

type NewCredential = {
  label: string;
  token: string;
};

export default function OrganizationServiceAccounts() {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {openModal} = useModal();
  const [newCredential, setNewCredential] = useState<NewCredential | null>(null);

  const accountsQuery = useQuery(serviceAccountsQueryOptions(organization.slug));
  const teamsQuery = useQuery(
    apiOptions.as<Team[]>()('/organizations/$organizationIdOrSlug/teams/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {per_page: 100},
      staleTime: 30_000,
    })
  );

  const invalidateAccounts = () =>
    queryClient.invalidateQueries({
      queryKey: serviceAccountsQueryOptions(organization.slug).queryKey,
    });

  const updateMutation = useMutation({
    mutationFn: ({accountId, isActive}: {accountId: string; isActive: boolean}) =>
      fetchMutation<ServiceAccount>({
        url: serviceAccountUrl(organization.slug, accountId),
        method: 'PUT',
        data: {isActive},
      }),
    onSuccess: account => {
      invalidateAccounts();
      addSuccessMessage(
        account.isActive ? t('Enabled service account') : t('Disabled service account')
      );
    },
    onError: () => addErrorMessage(t('Could not update the service account. Try again.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (accountId: string) =>
      fetchMutation({
        url: serviceAccountUrl(organization.slug, accountId),
        method: 'DELETE',
      }),
    onSuccess: () => {
      invalidateAccounts();
      addSuccessMessage(t('Deleted service account'));
    },
    onError: () => addErrorMessage(t('Could not delete the service account. Try again.')),
  });

  const revokeMutation = useMutation({
    mutationFn: ({accountId, tokenId}: {accountId: string; tokenId: string}) =>
      fetchMutation({
        url: serviceAccountTokenUrl(organization.slug, accountId, tokenId),
        method: 'DELETE',
      }),
    onSuccess: () => {
      invalidateAccounts();
      addSuccessMessage(t('Revoked service account token'));
    },
    onError: () => addErrorMessage(t('Could not revoke the token. Try again.')),
  });

  const teams = teamsQuery.data ?? [];
  const openCreateAccount = () =>
    openModal(modalProps => (
      <CreateServiceAccountForm
        {...modalProps}
        organization={organization}
        teams={teams}
        onCreated={account =>
          setNewCredential({label: account.name, token: account.token})
        }
      />
    ));

  const openEditAccount = (account: ServiceAccount) =>
    openModal(modalProps => (
      <EditServiceAccountForm
        {...modalProps}
        account={account}
        organization={organization}
        teams={teams}
      />
    ));

  const openCreateToken = (account: ServiceAccount) =>
    openModal(modalProps => (
      <CreateServiceAccountTokenForm
        {...modalProps}
        account={account}
        organization={organization}
        onCreated={token =>
          setNewCredential({label: token.name ?? account.name, token: token.token})
        }
      />
    ));

  const confirmDelete = (account: ServiceAccount) =>
    openConfirmModal({
      header: t('Delete Service Account'),
      message: t('This revokes every token for %s and removes its access.', account.name),
      confirmText: t('Delete Service Account'),
      priority: 'danger',
      isDangerous: true,
      onConfirm: async () => {
        await deleteMutation.mutateAsync(account.id);
      },
    });

  const confirmRevoke = (account: ServiceAccount, tokenId: string, tokenName: string) =>
    openConfirmModal({
      header: t('Revoke Token'),
      message: t('Requests using %s will stop working immediately.', tokenName),
      confirmText: t('Revoke Token'),
      priority: 'danger',
      isDangerous: true,
      onConfirm: async () => {
        await revokeMutation.mutateAsync({accountId: account.id, tokenId});
      },
    });

  return (
    <SentryDocumentTitle title={t('Service Accounts')} orgSlug={organization.slug}>
      <Stack gap="xl">
        <SettingsPageHeader
          title={t('Service Accounts')}
          subtitle={t(
            'Create non-human actors with organization roles, team membership, and API token permissions.'
          )}
          action={
            <Button
              variant="primary"
              icon={<IconAdd />}
              onClick={openCreateAccount}
              disabled={teamsQuery.isPending}
            >
              {t('Create Service Account')}
            </Button>
          }
        />

        {newCredential && (
          <Alert.Container>
            <Alert variant="warning" showIcon>
              <Stack gap="md">
                <Text bold>{t('Copy the token for %s now', newCredential.label)}</Text>
                <Text>{t("Sentry won't show this token again.")}</Text>
                <TextCopyInput aria-label={t('New service account token')}>
                  {newCredential.token}
                </TextCopyInput>
                <Flex justify="end">
                  <Button size="sm" onClick={() => setNewCredential(null)}>
                    {t('Done')}
                  </Button>
                </Flex>
              </Stack>
            </Alert>
          </Alert.Container>
        )}

        {accountsQuery.isPending && <LoadingIndicator />}
        {accountsQuery.isError && (
          <LoadingError
            message={t('Could not load service accounts.')}
            onRetry={accountsQuery.refetch}
          />
        )}
        {accountsQuery.data?.length === 0 && (
          <Container border="primary" radius="md" padding="2xl">
            <Stack gap="md" align="center">
              <Heading as="h2" size="md">
                {t('No Service Accounts')}
              </Heading>
              <Text variant="muted">
                {t('Create an account for automation that needs access to Sentry.')}
              </Text>
              <Button variant="primary" icon={<IconAdd />} onClick={openCreateAccount}>
                {t('Create Service Account')}
              </Button>
            </Stack>
          </Container>
        )}

        {accountsQuery.data?.map(account => {
          const roleName =
            organization.orgRoleList.find(role => role.id === account.role)?.name ??
            account.role;
          return (
            <Container key={account.id} border="primary" radius="md" padding="lg">
              <Stack gap="lg">
                <Flex
                  align="start"
                  justify="between"
                  gap="lg"
                  direction={{xs: 'column', md: 'row'}}
                >
                  <Stack gap="xs">
                    <Flex align="center" gap="sm">
                      <Heading as="h2" size="md">
                        {account.name}
                      </Heading>
                      <Tag variant={account.isActive ? 'success' : 'muted'}>
                        {account.isActive ? t('Active') : t('Disabled')}
                      </Tag>
                    </Flex>
                    <Text variant="muted">
                      {account.teams.length
                        ? t(
                            '%s · %s',
                            roleName,
                            account.teams.map(team => `#${team}`).join(', ')
                          )
                        : t('%s · No assigned teams', roleName)}
                    </Text>
                  </Stack>
                  <Flex gap="sm" wrap="wrap">
                    <Button
                      size="sm"
                      icon={<IconEdit />}
                      onClick={() => openEditAccount(account)}
                    >
                      {t('Edit')}
                    </Button>
                    <Button
                      size="sm"
                      busy={
                        updateMutation.isPending &&
                        updateMutation.variables?.accountId === account.id
                      }
                      onClick={() =>
                        updateMutation.mutate({
                          accountId: account.id,
                          isActive: !account.isActive,
                        })
                      }
                    >
                      {account.isActive ? t('Disable') : t('Enable')}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={<IconDelete />}
                      onClick={() => confirmDelete(account)}
                    >
                      {t('Delete')}
                    </Button>
                  </Flex>
                </Flex>

                <Stack.Separator />
                <Flex align="center" justify="between" gap="md">
                  <Heading as="h3" size="sm">
                    {t('Tokens')}
                  </Heading>
                  <Button
                    size="sm"
                    icon={<IconLock />}
                    onClick={() => openCreateToken(account)}
                  >
                    {t('Create Token')}
                  </Button>
                </Flex>
                {account.tokens.length === 0 ? (
                  <Text variant="muted">{t('No active tokens')}</Text>
                ) : (
                  <Stack gap="sm">
                    {account.tokens.map(token => (
                      <Flex key={token.id} align="center" justify="between" gap="md">
                        <Stack gap="2xs">
                          <Text bold>{token.name ?? t('Unnamed token')}</Text>
                          <Text size="sm" variant="muted" monospace>
                            {t(
                              'Ending in %s · %s',
                              token.tokenLastCharacters ?? '—',
                              token.scopes.join(', ')
                            )}
                          </Text>
                        </Stack>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() =>
                            confirmRevoke(
                              account,
                              token.id,
                              token.name ?? t('this token')
                            )
                          }
                        >
                          {t('Revoke')}
                        </Button>
                      </Flex>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Container>
          );
        })}
      </Stack>
    </SentryDocumentTitle>
  );
}
