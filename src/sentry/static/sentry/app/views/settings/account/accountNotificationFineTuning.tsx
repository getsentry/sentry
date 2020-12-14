import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Pagination from 'app/components/pagination';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {fields} from 'app/data/forms/accountNotificationSettings';
import {t} from 'app/locale';
import {Organization, Project, UserEmail} from 'app/types';
import withOrganizations from 'app/utils/withOrganizations';
import AsyncView from 'app/views/asyncView';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SelectField from 'app/views/settings/components/forms/selectField';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

type FineTuneField = {
  title: string;
  description: string;
  type: 'select';
  choices?: any;
  defaultValue?: number;
  defaultFieldName?: string;
};

const ACCOUNT_NOTIFICATION_FIELDS: Record<string, FineTuneField> = {
  alerts: {
    title: 'Project Alerts',
    description: t('Control alerts that you receive per project.'),
    type: 'select',
    choices: [
      [-1, t('Default')],
      [1, t('On')],
      [0, t('Off')],
    ],
    defaultValue: -1,
    defaultFieldName: 'subscribeByDefault',
  },
  workflow: {
    title: 'Workflow Notifications',
    description: t(
      'Control workflow notifications, e.g. changes in issue assignment, resolution status, and comments.'
    ),
    type: 'select',
    choices: [
      [-1, t('Default')],
      [0, t('Always')],
      [1, t('Only on issues I subscribe to')],
      [2, t('Never')],
    ],
    defaultValue: -1,
    defaultFieldName: 'workflowNotifications',
  },
  deploy: {
    title: t('Deploy Notifications'),
    description: t(
      'Control deploy notifications that include release, environment, and commit overviews.'
    ),
    type: 'select',
    choices: [
      [-1, t('Default')],
      [2, t('Always')],
      [3, t('Only on deploys with my commits')],
      [4, t('Never')],
    ],
    defaultValue: -1,
    defaultFieldName: 'deployNotifications',
  },
  reports: {
    title: t('Weekly Reports'),
    description: t(
      "Reports contain a summary of what's happened within the organization."
    ),
    type: 'select',
    // API only saves organizations that have this disabled, so we should default to "On"
    defaultValue: 1,
    choices: [
      [1, t('On')],
      [0, t('Off')],
    ],
    defaultFieldName: 'weeklyReports',
  },

  email: {
    title: t('Email Routing'),
    description: t(
      'On a per project basis, route emails to an alternative email address.'
    ),
    type: 'select',
    // No choices here because it's going to have dynamic content
    // Component will create choices
  },
};

const PanelBodyLineItem = styled(PanelBody)`
  font-size: 1.4rem;
  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
`;

// Which fine tuning parts are grouped by project
const isGroupedByProject = (type: string) =>
  ['alerts', 'workflow', 'email'].indexOf(type) > -1;

function groupByOrganization(projects: Project[]) {
  return projects.reduce<
    Record<string, {organization: Organization; projects: Project[]}>
  >((acc, project) => {
    const orgSlug = project.organization.slug;
    if (acc.hasOwnProperty(orgSlug)) {
      acc[orgSlug].projects.push(project);
    } else {
      acc[orgSlug] = {
        organization: project.organization,
        projects: [project],
      };
    }
    return acc;
  }, {});
}

type ANBPProps = {
  projects: Project[];
  field: FineTuneField;
};

const AccountNotificationsByProject = ({projects, field}: ANBPProps) => {
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
      label: project.slug,
    })),
  }));

  return (
    <React.Fragment>
      {data.map(({name, projects: projectFields}) => (
        <div key={name}>
          <PanelHeader>{name}</PanelHeader>
          {projectFields.map(f => (
            <PanelBodyLineItem key={f.name}>
              <SelectField
                deprecatedSelectControl
                defaultValue={f.defaultValue}
                name={f.name}
                choices={f.choices}
                label={f.label}
              />
            </PanelBodyLineItem>
          ))}
        </div>
      ))}
    </React.Fragment>
  );
};

type ANBOProps = {
  organizations: Organization[];
  field: FineTuneField;
};

const AccountNotificationsByOrganization = ({organizations, field}: ANBOProps) => {
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
    <React.Fragment>
      {data.map(f => (
        <PanelBodyLineItem key={f.name}>
          <SelectField
            deprecatedSelectControl
            defaultValue={f.defaultValue}
            name={f.name}
            choices={f.choices}
            label={f.label}
          />
        </PanelBodyLineItem>
      ))}
    </React.Fragment>
  );
};

const AccountNotificationsByOrganizationContainer = withOrganizations(
  AccountNotificationsByOrganization
);

type Props = AsyncView['props'] & RouteComponentProps<{fineTuneType: string}, {}>;

type State = AsyncView['state'] & {
  emails: UserEmail[] | null;
  projects: Project[] | null;
  notifications: Record<string, any> | null;
  fineTuneData: Record<string, any> | null;
};

export default class AccountNotificationFineTuning extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {fineTuneType} = this.props.params;
    const endpoints = [
      ['notifications', '/users/me/notifications/'],
      ['fineTuneData', `/users/me/notifications/${fineTuneType}/`],
    ];

    if (isGroupedByProject(fineTuneType)) {
      endpoints.push(['projects', '/projects/']);
    }

    endpoints.push(['emails', '/users/me/emails/']);
    if (fineTuneType === 'email') {
      endpoints.push(['emails', '/users/me/emails/']);
    }

    return endpoints as ReturnType<AsyncView['getEndpoints']>;
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
          } else if (b.isPrimary) {
            return 1;
          }

          return a.email < b.email ? -1 : 1;
        }) ?? []
    );
  }

  renderBody() {
    const {fineTuneType} = this.props.params;
    const {notifications, projects, fineTuneData, projectsPageLinks} = this.state;

    const isProject = isGroupedByProject(fineTuneType);
    const field = ACCOUNT_NOTIFICATION_FIELDS[fineTuneType];
    const {title, description} = field;

    const [stateKey, url] = isProject ? this.getEndpoints()[2] : [];
    const hasProjects = !!projects?.length;

    if (fineTuneType === 'email') {
      // Fetch verified email addresses
      field.choices = this.emailChoices.map(({email}) => [email, email]);
    }

    if (!notifications || !fineTuneData) {
      return null;
    }

    return (
      <div>
        <SettingsPageHeader title={title} />
        {description && <TextBlock>{description}</TextBlock>}

        {field &&
          field.defaultFieldName &&
          // not implemented yet
          field.defaultFieldName !== 'weeklyReports' && (
            <Form
              saveOnBlur
              apiMethod="PUT"
              apiEndpoint="/users/me/notifications/"
              initialData={notifications}
            >
              <JsonForm
                title={`Default ${title}`}
                fields={[fields[field.defaultFieldName]]}
              />
            </Form>
          )}
        <Panel>
          <PanelBody>
            <PanelHeader hasButtons={isProject}>
              <Heading>{isProject ? t('Projects') : t('Organizations')}</Heading>
              <div>
                {isProject &&
                  this.renderSearchInput({
                    placeholder: t('Search Projects'),
                    url,
                    stateKey,
                  })}
              </div>
            </PanelHeader>

            <Form
              saveOnBlur
              apiMethod="PUT"
              apiEndpoint={`/users/me/notifications/${fineTuneType}/`}
              initialData={fineTuneData}
            >
              {isProject && hasProjects && (
                <AccountNotificationsByProject projects={projects!} field={field} />
              )}

              {isProject && !hasProjects && (
                <EmptyMessage>{t('No projects found')}</EmptyMessage>
              )}

              {!isProject && (
                <AccountNotificationsByOrganizationContainer field={field} />
              )}
            </Form>
          </PanelBody>
        </Panel>

        {projects && <Pagination pageLinks={projectsPageLinks} {...this.props} />}
      </div>
    );
  }
}

const Heading = styled('div')`
  flex: 1;
`;
