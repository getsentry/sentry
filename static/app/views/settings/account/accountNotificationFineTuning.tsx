import {Fragment} from 'react';
import {parseAsString, useQueryState} from 'nuqs';
import {z} from 'zod';

import {AutoSaveForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Pagination} from 'sentry/components/pagination';
import {Panel} from 'sentry/components/panels/panel';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {SearchBar} from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Project} from 'sentry/types/project';
import type {UserEmail} from 'sentry/types/user';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation, keepPreviousData, useApiQuery} from 'sentry/utils/queryClient';
import {ACCOUNT_NOTIFICATION_FIELDS} from 'sentry/views/settings/account/notifications/fields';
import {OrganizationSelectHeader} from 'sentry/views/settings/account/notifications/organizationSelectHeader';
import {groupByOrganization} from 'sentry/views/settings/account/notifications/utils';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {TextBlock} from 'sentry/views/settings/components/text/textBlock';

type EmailSelectOption = {label: string; value: string};

type ANBPProps = {
  emailChoices: EmailSelectOption[];
  emailsByProject: Record<string, any>;
  projects: Project[];
  refetchEmailsByProject: () => void;
};

function AccountNotificationsByProject({
  projects,
  emailChoices,
  emailsByProject,
  refetchEmailsByProject,
}: ANBPProps) {
  const projectsByOrg = groupByOrganization(projects);

  return (
    <Fragment>
      {Object.values(projectsByOrg).map(org =>
        org.projects.map((project, i) => {
          const schema = z.object({[project.id]: z.string()});
          return (
            <Fragment key={project.id}>
              {i === 0 ? null : <Stack.Separator />}
              <AutoSaveForm
                name={project.id}
                schema={schema}
                initialValue={emailsByProject?.[project.id] ?? ''}
                mutationOptions={{
                  mutationFn: (data: Record<string, string>) =>
                    fetchMutation({
                      method: 'PUT',
                      url: '/users/me/notifications/email/',
                      data,
                    }),
                  onSuccess: () => refetchEmailsByProject(),
                }}
              >
                {field => (
                  <field.Layout.Row
                    padding="xl"
                    label={
                      <ProjectBadge
                        project={project}
                        avatarSize={20}
                        avatarProps={{consistentWidth: true}}
                        disableLink
                      />
                    }
                  >
                    <field.Select
                      value={field.state.value}
                      onChange={field.handleChange}
                      options={emailChoices}
                    />
                  </field.Layout.Row>
                )}
              </AutoSaveForm>
            </Fragment>
          );
        })
      )}
    </Fragment>
  );
}

export function AccountNotificationFineTuning() {
  const {organizations} = useLegacyStore(OrganizationsStore);
  const config = useLegacyStore(ConfigStore);

  const [orgIdParam, setOrgId] = useQueryState('organizationId', parseAsString);
  const [cursor] = useQueryState('cursor', parseAsString);
  const [query, setQuery] = useQueryState('query', parseAsString);

  // Get org id from:
  // - query param
  // - subdomain
  // - default to first org
  const organizationId =
    orgIdParam ??
    organizations.find(({slug}) => slug === config?.customerDomain?.subdomain)?.id ??
    (organizations.length === 1 ? organizations[0]?.id : undefined);

  const {
    data: projects,
    isPending: isPendingProjects,
    isError: isErrorProjects,
    getResponseHeader: getProjectsResponseHeader,
  } = useApiQuery<Project[]>(
    [
      getApiUrl('/projects/'),
      {
        query: {
          organizationId,
          cursor,
          query,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: Boolean(organizationId),
    }
  );

  const {
    data: emails = [],
    isPending: isPendingEmails,
    isError: isErrorEmails,
  } = useApiQuery<UserEmail[]>(
    [getApiUrl('/users/$userId/emails/', {path: {userId: 'me'}})],
    {
      staleTime: 0,
    }
  );
  const {
    data: emailsByProject,
    isPending: isPendingEmailsByProject,
    isError: isErrorEmailsByProject,
    refetch: refetchEmailsByProject,
  } = useApiQuery<Record<string, any>>(
    [getApiUrl('/users/$userId/notifications/email/', {path: {userId: 'me'}})],
    {
      staleTime: 0,
      placeholderData: keepPreviousData,
    }
  );

  const field = ACCOUNT_NOTIFICATION_FIELDS.email!;
  const isPending = isPendingProjects || isPendingEmailsByProject || isPendingEmails;
  const isError = isErrorProjects || isErrorEmails || isErrorEmailsByProject;

  // Verified email addresses
  const emailChoices: EmailSelectOption[] = emails
    .filter(({isVerified}) => isVerified)
    .sort((a, b) => {
      if (a.isPrimary) {
        return -1;
      }
      if (b.isPrimary) {
        return 1;
      }
      return a.email < b.email ? -1 : 1;
    })
    .map(({email}) => ({value: email, label: email}));

  if (isError) {
    return <LoadingError />;
  }

  if (!emailsByProject && !isPending) {
    return null;
  }

  const hasProjects = !!projects?.length;
  const mainContent = isPending ? (
    <LoadingIndicator />
  ) : (
    <Fragment>
      {hasProjects ? (
        <AccountNotificationsByProject
          projects={projects}
          emailChoices={emailChoices}
          emailsByProject={emailsByProject}
          refetchEmailsByProject={refetchEmailsByProject}
        />
      ) : (
        <EmptyMessage>{t('No projects found')}</EmptyMessage>
      )}
    </Fragment>
  );

  return (
    <div>
      <SettingsPageHeader title={field.title} />
      {field.description && <TextBlock>{field.description}</TextBlock>}
      <Panel>
        <PanelHeader hasButtons>
          <Flex wrap="wrap" gap="md" flex="1" align="center">
            <OrganizationSelectHeader
              organizations={organizations}
              organizationId={organizationId}
              handleOrgChange={(newOrgId: string) => {
                void setOrgId(newOrgId);
              }}
            />
            <SearchBar
              placeholder={t('Search Projects')}
              query={query ?? undefined}
              onSearch={value => {
                void setQuery(value || null);
              }}
            />
          </Flex>
        </PanelHeader>
        <Stack>
          {organizationId ? (
            mainContent
          ) : (
            <EmptyStateWarning withIcon={false}>
              {t('Select an organization to continue')}
            </EmptyStateWarning>
          )}
        </Stack>
      </Panel>
      {projects && <Pagination pageLinks={getProjectsResponseHeader?.('Link')} />}
    </div>
  );
}
