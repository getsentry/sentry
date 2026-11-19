import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';

import {DateTime} from '@sentry/scraps/dateTime';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Link} from '@sentry/scraps/link';
import {Pagination} from '@sentry/scraps/pagination';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getPaginationProps} from 'sentry/utils/pagination';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {serviceAccountsApiOptions} from './serviceAccountApi';
import {ServiceAccountOwnerKind} from './serviceAccountOwnerKind';
import {PermissionCount} from './serviceAccountPermissionTable';
import {ProjectAccessSummary} from './serviceAccountProjectAccess';

const COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: 'minmax(0, 2fr)'},
  {key: 'owner', width: 'max-content'},
  {key: 'permissions', width: 'max-content'},
  {key: 'projects', width: 'minmax(0, 1fr)'},
  {key: 'created', width: 'max-content'},
];

export default function OrganizationServiceAccounts() {
  const organization = useOrganization();
  const location = useLocation();
  const cursor = decodeScalar(location.query.cursor);
  const {data, isPending, isError, refetch} = useQuery({
    ...serviceAccountsApiOptions(organization, {cursor}),
    select: selectJsonWithHeaders,
  });
  const accounts = data?.json ?? [];

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
              <ServiceAccountOwnerKind ownerKind={account.ownerKind} />
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
      <Pagination {...getPaginationProps(data?.headers.Link)} />
    </Fragment>
  );
}
