import {Fragment} from 'react';
import {IconDelete} from '@sentry/icons/delete';
import {IconEdit} from '@sentry/icons/edit';
import {useQuery} from '@tanstack/react-query';

import {Button, LinkButton} from '@sentry/scraps/button';
import {DateTime} from '@sentry/scraps/dateTime';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {ConfirmDelete} from 'sentry/components/confirmDelete';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {serviceAccountApiOptions, useDeleteServiceAccount} from './serviceAccountApi';
import {ServiceAccountOwnerKind} from './serviceAccountOwnerKind';
import {
  PermissionCount,
  ServiceAccountPermissionTable,
} from './serviceAccountPermissionTable';
import {ProjectAccessBadges} from './serviceAccountProjectAccess';
import type {ServiceAccount} from './types';
import {useCannotManageReason} from './useServiceAccountAccess';

function Detail({label, children}: {children: React.ReactNode; label: string}) {
  return (
    <Stack gap="xs" minWidth="0">
      <Text bold>{label}</Text>
      {children}
    </Stack>
  );
}

function ServiceAccountActions({account}: {account: ServiceAccount}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const cannotManageReason = useCannotManageReason(account);
  const deleteAccount = useDeleteServiceAccount(organization, account.id);

  const listPath = `/settings/${organization.slug}/service-accounts/`;
  const disabledProps = cannotManageReason
    ? {disabled: true, tooltipProps: {title: cannotManageReason}}
    : {};
  const deleteButton = (
    <Button icon={<IconDelete />} {...disabledProps}>
      {t('Delete')}
    </Button>
  );

  return (
    <Flex gap="md">
      <LinkButton
        icon={<IconEdit />}
        to={`${listPath}${account.id}/edit/`}
        {...disabledProps}
      >
        {t('Edit')}
      </LinkButton>
      {cannotManageReason ? (
        deleteButton
      ) : (
        <ConfirmDelete
          header={t('Delete %s?', account.name)}
          confirmText={t('Delete Service Account')}
          confirmInput={account.name}
          message={t(
            'Its access tokens stop working right away, so anything using them will fail. Its history stays in the audit log. You can’t undo this.'
          )}
          onConfirm={() =>
            deleteAccount.mutate(undefined, {
              onSuccess: () => {
                toast.success(t('Service account deleted.'));
                navigate(listPath);
              },
              onError: error => {
                toast.error(
                  getRequestErrorUserMessage(
                    error,
                    t('Unable to delete service account.')
                  )
                );
              },
            })
          }
        >
          {deleteButton}
        </ConfirmDelete>
      )}
    </Flex>
  );
}

export default function ServiceAccountDetails() {
  const organization = useOrganization();
  const {serviceAccountId} = useParams<{serviceAccountId: string}>();
  const {
    data: account,
    isPending,
    isError,
    refetch,
  } = useQuery(serviceAccountApiOptions(organization, serviceAccountId));

  if (isError) {
    return (
      <LoadingError message={t('Failed to load service account.')} onRetry={refetch} />
    );
  }
  if (isPending) {
    return <LoadingIndicator />;
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={account.name} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={account.name}
        subtitle={
          account.ownerKind === 'seer_workflow_config'
            ? t(
                'This account belongs to a Seer automation. Change its access from the automation.'
              )
            : undefined
        }
        action={<ServiceAccountActions account={account} />}
      />
      <Stack gap="2xl">
        <Grid columns={{zero: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))'}} gap="xl">
          <Detail label={t('Owner')}>
            <ServiceAccountOwnerKind ownerKind={account.ownerKind} />
          </Detail>
          <Detail label={t('Permissions')}>
            <PermissionCount scopes={account.scopes} />
          </Detail>
          <Detail label={t('Project access')}>
            <ProjectAccessBadges account={account} />
          </Detail>
          <Detail label={t('Created')}>
            <Text>
              <DateTime date={account.dateCreated} mode="date" year="always" />
            </Text>
          </Detail>
        </Grid>

        <Stack gap="lg">
          <Heading as="h3">{t('Permissions')}</Heading>
          <ServiceAccountPermissionTable scopes={account.scopes} />
        </Stack>
      </Stack>
    </Fragment>
  );
}
