import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {DateTime} from '@sentry/scraps/dateTime';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Link} from '@sentry/scraps/link';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {serviceAccountsApiOptions} from './serviceAccountApi';
import {PermissionCount} from './serviceAccountPermissionTable';
import {ProjectAccessSummary} from './serviceAccountProjectAccess';
import type {ServiceAccount} from './types';

const COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: 'minmax(0, 2fr)'},
  {key: 'owner', width: 'max-content'},
  {key: 'permissions', width: 'max-content'},
  {key: 'projects', width: 'minmax(0, 1fr)'},
  {key: 'created', width: 'max-content'},
];

function OwnerKind({ownerKind}: {ownerKind: ServiceAccount['ownerKind']}) {
  switch (ownerKind) {
    case 'organization':
      return <Text>{t('Organization')}</Text>;
    case 'seer_workflow_config':
      return <Tag variant="muted">{t('Seer automation')}</Tag>;
    default:
      return <Text variant="muted">{t('Unknown')}</Text>;
  }
}

export default function OrganizationServiceAccounts() {
  const organization = useOrganization();
  const {
    data: accounts,
    isPending,
    isError,
    refetch,
  } = useQuery(serviceAccountsApiOptions(organization));

  const basePath = `/settings/${organization.slug}/service-accounts/`;

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Service Accounts')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Service Accounts')}
        subtitle={t(
          'Non-human accounts for CI, scripts, agents and integrations. Each one has its own permissions and access tokens, and never acts as the person who created it.'
        )}
      />
      <SimpleTable
        columns={COLUMNS}
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Name')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Owner')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Permissions')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Project access')}</SimpleTable.HeaderCell>
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
                'Service accounts give CI, scripts or agents their own credentials instead of a personal token.'
              )}
            />
          </SimpleTable.Empty>
        )}
        {accounts?.map(account => (
          <SimpleTable.Row key={account.id}>
            <SimpleTable.RowCell>
              <Link to={`${basePath}${account.id}/`}>{account.name}</Link>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <OwnerKind ownerKind={account.ownerKind} />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <PermissionCount scopes={account.scopes} />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <ProjectAccessSummary account={account} />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text>
                <DateTime date={account.dateCreated} mode="date" year="always" />
              </Text>
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        ))}
      </SimpleTable>
    </Fragment>
  );
}
