import {Fragment} from 'react';
import {IconAdd} from '@sentry/icons/add';
import {useQuery} from '@tanstack/react-query';

import {LinkButton} from '@sentry/scraps/button';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct, tn} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {serviceAccountsOptions} from './mockServiceAccountApi';
import {getBundle} from './serviceAccountData';
import {getAccountProjects} from './serviceAccountUtils';
import type {ServiceAccount} from './types';
import {useServiceAccountAccess} from './useServiceAccountAccess';

const COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: 'minmax(0, 2fr)'},
  {key: 'permissions', width: 'max-content'},
  {key: 'projects', width: 'minmax(0, 1fr)'},
  {key: 'tokens', width: 'max-content'},
  {key: 'created', width: 'max-content'},
];

function ProjectAccessCell({account}: {account: ServiceAccount}) {
  const {projects} = useProjects();
  if (account.allProjects) {
    return <Text>{t('All projects')}</Text>;
  }
  const accountProjects = getAccountProjects(account, projects);
  if (accountProjects.length <= 2) {
    return (
      <Text ellipsis>{accountProjects.map(project => project.slug).join(', ')}</Text>
    );
  }
  return <Text>{tn('%s project', '%s projects', accountProjects.length)}</Text>;
}

export default function OrganizationServiceAccounts() {
  const organization = useOrganization();
  const {canWrite, noCreateReason} = useServiceAccountAccess();
  const {
    data: accounts,
    isPending,
    isError,
    refetch,
  } = useQuery(serviceAccountsOptions());

  const basePath = `/settings/${organization.slug}/service-accounts/`;

  const newAccountButton = (
    <LinkButton
      variant="primary"
      icon={<IconAdd />}
      to={`${basePath}new/`}
      disabled={!canWrite}
      tooltipProps={canWrite ? undefined : {title: noCreateReason}}
    >
      {t('New Service Account')}
    </LinkButton>
  );

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Service Accounts')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Service Accounts')}
        action={newAccountButton}
        subtitle={t(
          'Non-human accounts for CI, scripts, agents and integrations. Each one has its own permissions and access tokens, and never acts as the person who created it.'
        )}
      />
      <SimpleTable
        columns={COLUMNS}
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Name')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Permissions')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Project access')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Active tokens')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Created')}</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {isError && (
          <SimpleTable.Error
            message={t('Failed to load service accounts.')}
            onRetry={refetch}
          />
        )}
        {!isError && isPending && <SimpleTable.Loading />}
        {!isError && !isPending && accounts.length === 0 && (
          <SimpleTable.Empty>
            <EmptyState
              title={t('No service accounts yet')}
              description={t(
                'Create one to give CI, scripts or agents their own credentials instead of a personal token.'
              )}
              action={newAccountButton}
            />
          </SimpleTable.Empty>
        )}
        {accounts?.map(account => (
          <SimpleTable.Row key={account.id}>
            <SimpleTable.RowCell>
              <Stack gap="2xs" minWidth="0">
                <Link to={`${basePath}${account.id}/`}>{account.name}</Link>
                {account.description && (
                  <Text size="sm" variant="muted" ellipsis>
                    {account.description}
                  </Text>
                )}
              </Stack>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text>{getBundle(account.bundleId).name}</Text>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <ProjectAccessCell account={account} />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              {account.activeTokenCount === 0 ? (
                <Text variant="muted">{t('None')}</Text>
              ) : (
                <Text>{account.activeTokenCount}</Text>
              )}
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text>
                {tct('[date] by [name]', {
                  date: <DateTime date={account.dateCreated} dateOnly year />,
                  name: account.createdBy.name,
                })}
              </Text>
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        ))}
      </SimpleTable>
    </Fragment>
  );
}
