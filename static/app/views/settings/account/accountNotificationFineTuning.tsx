import {Fragment} from 'react';
import styled from '@emotion/styled';

import EmptyMessage from 'sentry/components/emptyMessage';
import SelectField from 'sentry/components/forms/fields/selectField';
import Form from 'sentry/components/forms/form';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {UserEmail} from 'sentry/types/user';
import {keepPreviousData, useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import withOrganizations from 'sentry/utils/withOrganizations';
import type {FineTuneField} from 'sentry/views/settings/account/notifications/fields';
import {ACCOUNT_NOTIFICATION_FIELDS} from 'sentry/views/settings/account/notifications/fields';
import NotificationSettingsByType from 'sentry/views/settings/account/notifications/notificationSettingsByType';
import {OrganizationSelectHeader} from 'sentry/views/settings/account/notifications/organizationSelectHeader';
import {
  getNotificationTypeFromPathname,
  groupByOrganization,
  isGroupedByProject,
} from 'sentry/views/settings/account/notifications/utils';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

const PanelBodyLineItem = styled(PanelBody)`
  font-size: 1rem;
  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
`;

const accountNotifications = [
  'alerts',
  'deploy',
  'workflow',
  'approval',
  'quota',
  'spikeProtection',
  'reports',
  'brokenMonitors',
];

type ANBPProps = {
  field: FineTuneField;
  projects: Project[];
};

function AccountNotificationsByProject({projects, field}: ANBPProps) {
  const projectsByOrg = groupByOrganization(projects);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {title, description, ...fieldConfig} = field;

  // Display as select box in this view regardless of the type specified in the config
  const data = Object.values(projectsByOrg).map(org => ({
    name: org.organization.name,
    projects: org.projects.map(project => ({
      ...fieldConfig,
      // `name` key refers to field name
      // we use project.id because slugs are not unique across orgs
      name: project.id,
      label: (
        <ProjectBadge
          project={project}
          avatarSize={20}
          avatarProps={{consistentWidth: true}}
          disableLink
        />
      ),
    })),
  }));

  return (
    <Fragment>
      {data.map(({name, projects: projectFields}) => (
        <div key={name}>
          {projectFields.map(f => (
            <PanelBodyLineItem key={f.name}>
              <SelectField
                defaultValue={f.defaultValue}
                name={f.name}
                options={f.options}
                label={f.label}
              />
            </PanelBodyLineItem>
          ))}
        </div>
      ))}
    </Fragment>
  );
}

type ANBOProps = {
  field: FineTuneField;
};

function AccountNotificationsByOrganization({field}: ANBOProps) {
  const {organizations} = useLegacyStore(OrganizationsStore);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {title, description, ...fieldConfig} = field;

  // Display as select box in this view regardless of the type specified in the config
  const data = organizations.map(org => ({
    ...fieldConfig,
    // `name` key refers to field name
    // we use org.id to remain consistent project.id use (which is required because slugs are not unique across orgs)
    name: org.id,
    label: org.slug,
  }));

  return (
    <Fragment>
      {data.map(f => (
        <PanelBodyLineItem key={f.name}>
          <SelectField
            defaultValue={f.defaultValue}
            name={f.name}
            options={f.options}
            label={f.label}
          />
        </PanelBodyLineItem>
      ))}
    </Fragment>
  );
}

interface AccountNotificationFineTuningProps {
  organizations: Organization[];
}

function AccountNotificationFineTuning({
  organizations,
}: AccountNotificationFineTuningProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{fineTuneType: string}>();
  const {fineTuneType: pathnameType} = params;
  const fineTuneType = getNotificationTypeFromPathname(pathnameType);
  const config = useLegacyStore(ConfigStore);

  // Get org id from:
  // - query param
  // - subdomain
  // - default to first org
  const organizationId =
    (location?.query?.organizationId as string | undefined) ??
    organizations.find(({slug}) => slug === config?.customerDomain?.subdomain)?.id ??
    organizations[0]?.id;

  const {
    data: notifications,
    isPending: isPendingNotifications,
    isError: isErrorNotifications,
  } = useApiQuery<Record<string, any>>(['/users/me/notifications/'], {staleTime: 0});
  const projectsEnabled = isGroupedByProject(fineTuneType);
  const {
    data: projects,
    isPending: isPendingProjects,
    isError: isErrorProjects,
    getResponseHeader: getProjectsResponseHeader,
  } = useApiQuery<Project[]>(
    [
      '/projects/',
      {
        query: {
          organizationId,
          cursor: location.query.cursor,
          query: location.query.query,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: projectsEnabled,
    }
  );
  const isLoadingProjects = projectsEnabled ? isPendingProjects : false;

  // Extra data specific to email notifications
  const isEmail = fineTuneType === 'email';
  const {
    data: emails = [],
    isPending: isPendingEmails,
    isError: isErrorEmails,
  } = useApiQuery<UserEmail[]>(['/users/me/emails/'], {
    staleTime: 0,
    enabled: isEmail,
  });
  const {
    data: emailsByProject,
    isPending: isPendingEmailsByProject,
    isError: isErrorEmailsByProject,
    refetch: refetchEmailsByProject,
  } = useApiQuery<Record<string, any>>(['/users/me/notifications/email/'], {
    staleTime: 0,
    enabled: isEmail,
    placeholderData: keepPreviousData,
  });

  if (accountNotifications.includes(fineTuneType)) {
    return <NotificationSettingsByType notificationType={fineTuneType} />;
  }

  const isProject = isGroupedByProject(fineTuneType) && organizations.length > 0;
  const field = ACCOUNT_NOTIFICATION_FIELDS[fineTuneType]!;
  // TODO(isabella): once GA, remove this
  if (
    fineTuneType === 'quota' &&
    organizations.some(org => org.features?.includes('spend-visibility-notifications'))
  ) {
    field.title = t('Spend Notifications');
    field.description = t(
      'Control the notifications you receive for organization spend.'
    );
  }

  if (isEmail) {
    // Vrified email addresses
    const emailChoices: UserEmail[] = emails
      .filter(({isVerified}) => isVerified)
      .sort((a, b) => {
        // Sort by primary -> email
        if (a.isPrimary) {
          return -1;
        }
        if (b.isPrimary) {
          return 1;
        }

        return a.email < b.email ? -1 : 1;
      });
    field.options = emailChoices.map(({email}) => ({value: email, label: email}));
  }

  if (
    isErrorProjects ||
    isErrorNotifications ||
    isErrorEmails ||
    isErrorEmailsByProject
  ) {
    return <LoadingError />;
  }

  if (!notifications || (!emailsByProject && fineTuneType === 'email')) {
    return null;
  }

  const hasProjects = !!projects?.length;
  const mainContent =
    isLoadingProjects ||
    isPendingNotifications ||
    (isEmail && (isPendingEmailsByProject || isPendingEmails)) ? (
      <LoadingIndicator />
    ) : (
      <Fragment>
        {isProject && hasProjects && (
          <AccountNotificationsByProject projects={projects} field={field} />
        )}

        {isProject && !hasProjects && (
          <EmptyMessage>{t('No projects found')}</EmptyMessage>
        )}

        {!isProject && <AccountNotificationsByOrganization field={field} />}
      </Fragment>
    );

  return (
    <div>
      <SettingsPageHeader title={field.title} />
      {field.description && <TextBlock>{field.description}</TextBlock>}
      <Panel>
        <StyledPanelHeader hasButtons={isProject}>
          {isProject ? (
            <Fragment>
              <OrganizationSelectHeader
                organizations={organizations}
                organizationId={organizationId}
                handleOrgChange={(newOrgId: string) => {
                  navigate(
                    {
                      ...location,
                      query: {organizationId: newOrgId},
                    },
                    {replace: true}
                  );
                }}
              />
              <SearchBar
                placeholder={t('Search Projects')}
                query={location.query.query as string | undefined}
                onSearch={value => {
                  navigate(
                    {
                      ...location,
                      query: {...location.query, query: value, cursor: undefined},
                    },
                    {replace: true}
                  );
                }}
              />
            </Fragment>
          ) : (
            <Heading>{t('Organizations')}</Heading>
          )}
        </StyledPanelHeader>
        <PanelBody>
          {/* Only email needs the form to change the emmail */}
          {fineTuneType === 'email' && emailsByProject && !isPendingEmailsByProject ? (
            <Form
              saveOnBlur
              apiMethod="PUT"
              apiEndpoint="/users/me/notifications/email/"
              initialData={emailsByProject}
              onSubmitSuccess={() => {
                refetchEmailsByProject();
              }}
            >
              {mainContent}
            </Form>
          ) : (
            mainContent
          )}
        </PanelBody>
      </Panel>
      {projects && <Pagination pageLinks={getProjectsResponseHeader?.('Link')} />}
    </div>
  );
}

const Heading = styled('div')`
  flex: 1;
`;

const StyledPanelHeader = styled(PanelHeader)`
  flex-wrap: wrap;
  gap: ${space(1)};
  & > form:last-child {
    flex-grow: 1;
  }
`;

export default withOrganizations(AccountNotificationFineTuning);
