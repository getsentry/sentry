import {Fragment} from 'react';
import {IconDelete} from '@sentry/icons/delete';
import {IconEdit} from '@sentry/icons/edit';
import {useQuery} from '@tanstack/react-query';

import {Button, LinkButton} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {ConfirmDelete} from 'sentry/components/confirmDelete';
import {DateTime} from 'sentry/components/dateTime';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct, tn} from 'sentry/locale';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {serviceAccountOptions, useDeleteServiceAccount} from './mockServiceAccountApi';
import {PermissionSummary, PermissionTable} from './permissionRows';
import {resolveBundle} from './serviceAccountData';
import {ServiceAccountTokens} from './serviceAccountTokens';
import {describePermissions, getAccountProjects} from './serviceAccountUtils';
import type {ServiceAccount} from './types';
import {useServiceAccountAccess} from './useServiceAccountAccess';

function Detail({label, children}: {children: React.ReactNode; label: string}) {
  return (
    <Stack gap="xs" minWidth="0">
      <Text bold>{label}</Text>
      {children}
    </Stack>
  );
}

const MAX_PROJECT_BADGES = 3;

function ProjectAccess({account}: {account: ServiceAccount}) {
  const {projects} = useProjects();
  const accountProjects = getAccountProjects(account, projects);
  if (account.allProjects) {
    return <Text>{t('All projects (%s)', accountProjects.length)}</Text>;
  }
  const hidden = accountProjects.slice(MAX_PROJECT_BADGES);
  return (
    <Flex wrap="wrap" gap="sm md" align="center">
      {accountProjects.slice(0, MAX_PROJECT_BADGES).map(project => (
        <ProjectBadge key={project.id} project={project} avatarSize={16} />
      ))}
      {hidden.length > 0 && (
        <InfoText title={hidden.map(project => project.slug).join(', ')}>
          {t('+%s more', hidden.length)}
        </InfoText>
      )}
    </Flex>
  );
}

export default function ServiceAccountDetails() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {serviceAccountId} = useParams<{serviceAccountId: string}>();
  const {canWrite, noWriteReason} = useServiceAccountAccess();
  const {
    data: account,
    isPending,
    isError,
    refetch,
  } = useQuery(serviceAccountOptions(serviceAccountId));
  const deleteAccount = useDeleteServiceAccount(serviceAccountId);

  const listPath = `/settings/${organization.slug}/service-accounts/`;

  if (isError) {
    return (
      <LoadingError message={t('Failed to load service account.')} onRetry={refetch} />
    );
  }
  if (isPending) {
    return <LoadingIndicator />;
  }

  const disabledProps = canWrite
    ? {}
    : {disabled: true, tooltipProps: {title: noWriteReason}};

  const deleteButton = (
    <Button icon={<IconDelete />} {...disabledProps}>
      {t('Delete')}
    </Button>
  );

  return (
    <Fragment>
      <SentryDocumentTitle title={account.name} orgSlug={organization.slug} />
      <SettingsPageHeader title={account.name} />
      <Stack gap="2xl">
        <Flex justify="between" align="start" gap="xl">
          <Stack gap="xs" minWidth="0">
            <Heading as="h1" size="2xl">
              {account.name}
            </Heading>
            {account.description && <Text variant="muted">{account.description}</Text>}
          </Stack>
          <Flex gap="md">
            <LinkButton
              icon={<IconEdit />}
              to={`${listPath}${account.id}/edit/`}
              {...disabledProps}
            >
              {t('Edit')}
            </LinkButton>
            {canWrite ? (
              <ConfirmDelete
                header={t('Delete %s?', account.name)}
                confirmText={t('Delete Service Account')}
                confirmInput={account.name}
                message={
                  account.activeTokenCount > 0
                    ? tct(
                        'This also revokes its [count]. Anything using them will stop working. Its history stays in the audit log. You can’t undo this.',
                        {
                          count: (
                            <strong>
                              {tn(
                                '%s active token',
                                '%s active tokens',
                                account.activeTokenCount
                              )}
                            </strong>
                          ),
                        }
                      )
                    : t('Its history stays in the audit log. You can’t undo this.')
                }
                onConfirm={() =>
                  deleteAccount.mutateAsync().then(() => {
                    toast.success(t('Service account deleted and its tokens revoked.'));
                    navigate(listPath);
                  })
                }
              >
                {deleteButton}
              </ConfirmDelete>
            ) : (
              deleteButton
            )}
          </Flex>
        </Flex>

        <Grid columns={{zero: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))'}} gap="xl">
          <Detail label={t('Permission level')}>
            <Text>{describePermissions(account)}</Text>
          </Detail>
          <Detail label={t('Project access')}>
            <ProjectAccess account={account} />
          </Detail>
          <Detail label={t('Created')}>
            <Text>
              {tct('[date] by [name]', {
                date: <DateTime date={account.dateCreated} dateOnly year />,
                name: account.createdBy.name,
              })}
            </Text>
          </Detail>
          <Detail label={t('Last activity')}>
            {account.dateLastActive ? (
              <TimeSince date={account.dateLastActive} />
            ) : (
              <Text variant="muted">{t('No activity yet')}</Text>
            )}
          </Detail>
        </Grid>

        <ServiceAccountTokens account={account} />

        <Stack gap="lg">
          <Stack gap="xs">
            <Heading as="h3">{t('Permissions')}</Heading>
            <PermissionSummary bundle={resolveBundle(account)} />
          </Stack>
          <PermissionTable bundle={resolveBundle(account)} />
        </Stack>
      </Stack>
    </Fragment>
  );
}
