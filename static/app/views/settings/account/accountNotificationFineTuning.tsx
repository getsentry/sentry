import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import EmptyMessage from 'sentry/components/emptyMessage';
import SelectField from 'sentry/components/forms/fields/selectField';
import Form from 'sentry/components/forms/form';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {Organization, Project, UserEmail} from 'sentry/types';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import withOrganizations from 'sentry/utils/withOrganizations';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';
import {
  ACCOUNT_NOTIFICATION_FIELDS,
  FineTuneField,
} from 'sentry/views/settings/account/notifications/fields';
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
          displayName={project.slug}
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
  organizations: Organization[];
};

function AccountNotificationsByOrganization({organizations, field}: ANBOProps) {
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

const AccountNotificationsByOrganizationContainer = withOrganizations(
  AccountNotificationsByOrganization
);

type Props = DeprecatedAsyncView['props'] &
  RouteComponentProps<{fineTuneType: string}, {}> & {
    organizations: Organization[];
  };

type State = DeprecatedAsyncView['state'] & {
  emails: UserEmail[] | null;
  emailsByProject: Record<string, any> | null;
  notifications: Record<string, any> | null;
  projects: Project[] | null;
};

class AccountNotificationFineTuning extends DeprecatedAsyncView<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    const {fineTuneType: pathnameType} = this.props.params;
    const fineTuneType = getNotificationTypeFromPathname(pathnameType);
    const endpoints: ReturnType<DeprecatedAsyncView['getEndpoints']> = [
      ['notifications', '/users/me/notifications/'],
    ];

    if (isGroupedByProject(fineTuneType)) {
      const organizationId = this.getOrganizationId();
      endpoints.push(['projects', `/projects/`, {query: {organizationId}}]);
    }

    // special logic for email
    if (fineTuneType === 'email') {
      endpoints.push(['emails', '/users/me/emails/']);
      endpoints.push(['emailsByProject', `/users/me/notifications/email/`]);
    }

    return endpoints;
  }

  // Return a sorted list of user's verified emails
  get emailChoices() {
    return (
      this.state.emails
        ?.filter(({isVerified}) => isVerified)
        ?.sort((a, b) => {
          // Sort by primary -> email
          if (a.isPrimary) {
            return -1;
          }
          if (b.isPrimary) {
            return 1;
          }

          return a.email < b.email ? -1 : 1;
        }) ?? []
    );
  }

  handleOrgChange = (organizationId: string) => {
    this.props.router.replace({
      ...this.props.location,
      query: {organizationId},
    });
  };

  getOrganizationId(): string | undefined {
    const {location, organizations} = this.props;
    const customerDomain = ConfigStore.get('customerDomain');
    const orgFromSubdomain = organizations.find(
      ({slug}) => slug === customerDomain?.subdomain
    )?.id;
    return location?.query?.organizationId ?? orgFromSubdomain ?? organizations[0]?.id;
  }

  renderBody() {
    const {params, organizations} = this.props;
    const {fineTuneType: pathnameType} = params;
    const fineTuneType = getNotificationTypeFromPathname(pathnameType);

    if (accountNotifications.includes(fineTuneType)) {
      return <NotificationSettingsByType notificationType={fineTuneType} />;
    }

    const {notifications, projects, emailsByProject, projectsPageLinks} = this.state;

    const isProject = isGroupedByProject(fineTuneType) && organizations.length > 0;
    const field = ACCOUNT_NOTIFICATION_FIELDS[fineTuneType];
    const {title, description} = field;

    const [stateKey] = isProject ? this.getEndpoints()[2] : [];
    const hasProjects = !!projects?.length;

    if (fineTuneType === 'email') {
      // Fetch verified email addresses
      field.options = this.emailChoices.map(({email}) => ({value: email, label: email}));
    }

    if (!notifications || (!emailsByProject && fineTuneType === 'email')) {
      return null;
    }

    const orgId = this.getOrganizationId();
    const paginationObject = parseLinkHeader(projectsPageLinks ?? '');
    const hasMore = paginationObject?.next?.results;
    const hasPrevious = paginationObject?.previous?.results;

    const mainContent = (
      <Fragment>
        {isProject && hasProjects && (
          <AccountNotificationsByProject projects={projects!} field={field} />
        )}

        {isProject && !hasProjects && (
          <EmptyMessage>{t('No projects found')}</EmptyMessage>
        )}

        {!isProject && <AccountNotificationsByOrganizationContainer field={field} />}
      </Fragment>
    );

    return (
      <div>
        <SettingsPageHeader title={title} />
        {description && <TextBlock>{description}</TextBlock>}
        <Panel>
          <StyledPanelHeader hasButtons={isProject}>
            {isProject ? (
              <Fragment>
                <OrganizationSelectHeader
                  organizations={organizations}
                  organizationId={orgId}
                  handleOrgChange={this.handleOrgChange}
                />
                {this.renderSearchInput({
                  placeholder: t('Search Projects'),
                  url: `/projects/?organizationId=${orgId}`,
                  stateKey,
                })}
              </Fragment>
            ) : (
              <Heading>{t('Organizations')}</Heading>
            )}
          </StyledPanelHeader>
          <PanelBody>
            {/* Only email needs the form to change the emmail */}
            {fineTuneType === 'email' && emailsByProject ? (
              <Form
                saveOnBlur
                apiMethod="PUT"
                apiEndpoint="/users/me/notifications/email/"
                initialData={emailsByProject}
              >
                {mainContent}
              </Form>
            ) : (
              mainContent
            )}
          </PanelBody>
        </Panel>

        {projects && (hasMore || hasPrevious) && (
          <Pagination pageLinks={projectsPageLinks} />
        )}
      </div>
    );
  }
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
