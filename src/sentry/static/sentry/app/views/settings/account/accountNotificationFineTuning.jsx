import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import ProjectsStore from 'app/stores/projectsStore';
import Select2Field from 'app/views/settings/components/forms/select2Field';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import {fields} from 'app/data/forms/accountNotificationSettings';
import withOrganizations from 'app/utils/withOrganizations';

const ACCOUNT_NOTIFICATION_FIELDS = {
  alerts: {
    title: 'Project Alerts',
    description: t('Control alerts that you receive per project.'),
    type: 'select',
    choices: [[-1, t('Default')], [1, t('On')], [0, t('Off')]],
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
    defaultFieldName: 'deployNotifications',
  },
  reports: {
    title: t('Weekly Reports'),
    description: t(
      "Reports contain a summary of what's happened within the organization."
    ),
    type: 'select',
    choices: [[1, t('On')], [0, t('Off')]],
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
  border-bottom: 1px solid ${p => p.theme.borderLight};
`;

// Which fine tuning parts are grouped by project
const isGroupedByProject = type => ['alerts', 'workflow', 'email'].indexOf(type) > -1;

class AccountNotificationsByProject extends React.Component {
  static propTypes = {
    projects: PropTypes.array,
    field: PropTypes.object,
  };

  getFieldData() {
    let {projects, field} = this.props;
    ProjectsStore.loadInitialData(projects);

    const projectsByOrg = ProjectsStore.getAllGroupedByOrganization();

    // eslint-disable-next-line no-unused-vars
    const {title, description, ...fieldConfig} = field;

    // Display as select box in this view regardless of the type specified in the config
    return Object.values(projectsByOrg).map(org => {
      return {
        name: org.organization.name,
        projects: org.projects.map(project => {
          return {
            ...fieldConfig,
            // `name` key refers to field name
            // we use project.id because slugs are not unique across orgs
            name: project.id,
            label: project.slug,
          };
        }),
      };
    });
  }

  render() {
    const data = this.getFieldData();

    return data.map(({name, projects: projectFields}) => {
      return (
        <div key={name}>
          <PanelHeader>{name}</PanelHeader>
          {projectFields.map(field => {
            return (
              <PanelBodyLineItem key={field.name}>
                <Select2Field
                  name={field.name}
                  choices={field.choices}
                  label={field.label}
                  small={true}
                />
              </PanelBodyLineItem>
            );
          })}
        </div>
      );
    });
  }
}

class AccountNotificationsByOrganization extends React.Component {
  static propTypes = {
    organizations: PropTypes.array,
    field: PropTypes.object,
  };

  getFieldData() {
    const {field, organizations} = this.props;
    // eslint-disable-next-line no-unused-vars
    const {title, description, ...fieldConfig} = field;

    // Display as select box in this view regardless of the type specified in the config
    return organizations.map(org => {
      return {
        ...fieldConfig,
        // `name` key refers to field name
        // we use org.id to remain consistent project.id use (which is required because slugs are not unique across orgs)
        name: org.id,
        label: org.slug,
      };
    });
  }

  render() {
    const orgFields = this.getFieldData();

    return (
      <React.Fragment>
        <PanelHeader>{t('Organizations')}</PanelHeader>
        {orgFields.map(field => {
          return (
            <PanelBodyLineItem key={field.name}>
              <Select2Field
                name={field.name}
                choices={field.choices}
                label={field.label}
                small
              />
            </PanelBodyLineItem>
          );
        })}
      </React.Fragment>
    );
  }
}

const AccountNotificationsByOrganizationContainer = withOrganizations(
  AccountNotificationsByOrganization
);

export default class AccountNotificationFineTuning extends AsyncView {
  getEndpoints() {
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

    return endpoints;
  }

  // Return a sorted list of user's verified emails
  getEmailChoices() {
    let {emails} = this.state;
    if (!emails) return [];

    return emails.filter(({isVerified}) => isVerified).sort((a, b) => {
      // Sort by primary -> email
      if (a.isPrimary) {
        return -1;
      } else if (b.isPrimary) {
        return 1;
      }

      return a.email < b.email ? -1 : 1;
    });
  }

  renderBody() {
    const {fineTuneType} = this.props.params;
    const isProject = isGroupedByProject(fineTuneType);
    const field = ACCOUNT_NOTIFICATION_FIELDS[fineTuneType];
    const {title, description} = field;

    if (fineTuneType === 'email') {
      // Fetch verified email addresses
      field.choices = this.getEmailChoices().map(({email}) => [email, email]);
    }

    return (
      <div>
        <SettingsPageHeader title={title} />
        {description && <TextBlock>{description}</TextBlock>}

        {field &&
          field.defaultFieldName && (
            <Form
              saveOnBlur
              apiMethod="PUT"
              apiEndpoint={'/users/me/notifications/'}
              initialData={this.state.notifications}
            >
              <JsonForm
                title={`Default ${title}`}
                fields={[fields[field.defaultFieldName]]}
              />
            </Form>
          )}
        <Form
          saveOnBlur
          apiMethod="PUT"
          apiEndpoint={`/users/me/notifications/${this.props.params.fineTuneType}/`}
          initialData={this.state.fineTuneData}
        >
          <Panel>
            {isProject && (
              <AccountNotificationsByProject
                projects={this.state.projects}
                field={field}
              />
            )}

            {!isProject && <AccountNotificationsByOrganizationContainer field={field} />}
          </Panel>
        </Form>
      </div>
    );
  }
}
