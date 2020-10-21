import PropTypes from 'prop-types';
import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {fields} from 'app/data/forms/accountNotificationSettings';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import Pagination from 'app/components/pagination';
import SelectField from 'app/views/settings/components/forms/selectField';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import withOrganizations from 'app/utils/withOrganizations';

const ACCOUNT_NOTIFICATION_FIELDS = {
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
  border-bottom: 1px solid ${p => p.theme.borderLight};
`;

// Which fine tuning parts are grouped by project
const isGroupedByProject = type => ['alerts', 'workflow', 'email'].indexOf(type) > -1;

function groupByOrganization(projects) {
  return projects.reduce((acc, project) => {
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

class AccountNotificationsByProject extends Component {
  static propTypes = {
    projects: PropTypes.array,
    field: PropTypes.object,
  };

  getFieldData() {
    const {projects, field} = this.props;
    const projectsByOrg = groupByOrganization(projects);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {title, description, ...fieldConfig} = field;

    // Display as select box in this view regardless of the type specified in the config
    return Object.values(projectsByOrg).map(org => ({
      name: org.organization.name,
      projects: org.projects.map(project => ({
        ...fieldConfig,
        // `name` key refers to field name
        // we use project.id because slugs are not unique across orgs
        name: project.id,
        label: project.slug,
      })),
    }));
  }

  render() {
    const data = this.getFieldData();

    return data.map(({name, projects: projectFields}) => (
      <div key={name}>
        <PanelHeader>{name}</PanelHeader>
        {projectFields.map(field => (
          <PanelBodyLineItem key={field.name}>
            <SelectField
              deprecatedSelectControl
              defaultValue={field.defaultValue}
              name={field.name}
              choices={field.choices}
              label={field.label}
            />
          </PanelBodyLineItem>
        ))}
      </div>
    ));
  }
}

class AccountNotificationsByOrganization extends Component {
  static propTypes = {
    organizations: PropTypes.array,
    field: PropTypes.object,
  };

  getFieldData() {
    const {field, organizations} = this.props;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {title, description, ...fieldConfig} = field;

    // Display as select box in this view regardless of the type specified in the config
    return organizations.map(org => ({
      ...fieldConfig,
      // `name` key refers to field name
      // we use org.id to remain consistent project.id use (which is required because slugs are not unique across orgs)
      name: org.id,
      label: org.slug,
    }));
  }

  render() {
    const orgFields = this.getFieldData();

    return (
      <Fragment>
        {orgFields.map(field => (
          <PanelBodyLineItem key={field.name}>
            <SelectField
              deprecatedSelectControl
              defaultValue={field.defaultValue}
              name={field.name}
              choices={field.choices}
              label={field.label}
            />
          </PanelBodyLineItem>
        ))}
      </Fragment>
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
    const {emails} = this.state;
    if (!emails) {
      return [];
    }

    return emails
      .filter(({isVerified}) => isVerified)
      .sort((a, b) => {
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
    const [stateKey, url] = isProject ? this.getEndpoints()[2] : [];
    const hasProjects = this.state.projects && !!this.state.projects.length;

    if (fineTuneType === 'email') {
      // Fetch verified email addresses
      field.choices = this.getEmailChoices().map(({email}) => [email, email]);
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
              initialData={this.state.notifications}
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
              apiEndpoint={`/users/me/notifications/${this.props.params.fineTuneType}/`}
              initialData={this.state.fineTuneData}
            >
              {isProject && hasProjects && (
                <AccountNotificationsByProject
                  projects={this.state.projects}
                  field={field}
                />
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

        {this.state.projects && (
          <Pagination pageLinks={this.state.projectsPageLinks} {...this.props} />
        )}
      </div>
    );
  }
}

const Heading = styled('div')`
  flex: 1;
`;
