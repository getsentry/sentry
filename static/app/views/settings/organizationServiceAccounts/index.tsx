import {Fragment} from 'react';
import {IconAdd} from '@sentry/icons/add';
import {useQuery} from '@tanstack/react-query';

import {LinkButton} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Link} from '@sentry/scraps/link';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tn} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import type {ServiceAccount} from './types';

const COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: 'minmax(0, 1fr)'},
  {key: 'permissions', width: 'minmax(0, 1fr)'},
  {key: 'projects', width: 'minmax(0, 1fr)'},
  {key: 'created', width: 'max-content'},
];

export const serviceAccountsOptions = ({orgSlug}: {orgSlug: string}) =>
  apiOptions.as<ServiceAccount[]>()(
    '/organizations/$organizationIdOrSlug/service-accounts/',
    {
      path: {organizationIdOrSlug: orgSlug},
      staleTime: 0,
    }
  );

export function ScopeSummary({scopes}: {scopes: string[]}) {
  return (
    <InfoText title={scopes.join(', ')}>
      {tn('%s scope', '%s scopes', scopes.length)}
    </InfoText>
  );
}

function ProjectAccess({
  serviceAccount,
  projectsById,
}: {
  projectsById: Map<string, Project>;
  serviceAccount: ServiceAccount;
}) {
  if (serviceAccount.allProjects) {
    return <Text>{t('All projects')}</Text>;
  }
  if (serviceAccount.projectIds.length === 0) {
    return <Text variant="muted">{t('No projects')}</Text>;
  }
  const slugs = serviceAccount.projectIds.map(id => projectsById.get(id)?.slug ?? id);
  return (
    <InfoText title={slugs.join(', ')}>
      {tn('%s project', '%s projects', slugs.length)}
    </InfoText>
  );
}

function ServiceAccountRow({
  orgSlug,
  serviceAccount,
  projectsById,
}: {
  orgSlug: string;
  projectsById: Map<string, Project>;
  serviceAccount: ServiceAccount;
}) {
  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell>
        <Text bold wordBreak="break-word">
          <Link to={`/settings/${orgSlug}/service-accounts/${serviceAccount.id}/`}>
            {serviceAccount.name}
          </Link>
        </Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <ScopeSummary scopes={serviceAccount.scopes} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <ProjectAccess serviceAccount={serviceAccount} projectsById={projectsById} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <TimeSince date={serviceAccount.dateCreated} />
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

export default function OrganizationServiceAccounts() {
  const organization = useOrganization();
  const {projects} = useProjects();
  const projectsById = new Map(projects.map(project => [project.id, project]));
  const canCreate = hasEveryAccess(['service_account:write'], {organization});

  const {
    data: serviceAccounts,
    isPending,
    isError,
    refetch,
  } = useQuery(serviceAccountsOptions({orgSlug: organization.slug}));

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Service Accounts')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Service Accounts')}
        subtitle={t(
          'Service accounts let CI, scripts, agents and integrations call Sentry with their own permissions, instead of acting as a person.'
        )}
        action={
          <LinkButton
            variant="primary"
            size="sm"
            icon={<IconAdd />}
            to={`/settings/${organization.slug}/service-accounts/new/`}
            disabled={!canCreate}
            tooltipProps={{
              title: canCreate
                ? undefined
                : t('You need the Manager or Owner role to create service accounts.'),
            }}
          >
            {t('New Service Account')}
          </LinkButton>
        }
      />
      <SimpleTable
        columns={COLUMNS}
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Name')}</SimpleTable.HeaderCell>
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
        {!isError && !isPending && serviceAccounts.length === 0 && (
          <SimpleTable.Empty>
            {t(
              'No service accounts yet. Create one to give CI, scripts or agents their own credentials instead of a personal token.'
            )}
          </SimpleTable.Empty>
        )}
        {!isError &&
          !isPending &&
          serviceAccounts.map(serviceAccount => (
            <ServiceAccountRow
              key={serviceAccount.id}
              orgSlug={organization.slug}
              serviceAccount={serviceAccount}
              projectsById={projectsById}
            />
          ))}
      </SimpleTable>
    </Fragment>
  );
}
