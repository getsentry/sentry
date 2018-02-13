import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from '../../../locale';
import AsyncView from '../../asyncView';
import Form from '../components/forms/form';
import Panel from '../components/panel';
import PanelBody from '../components/panelBody';
import PanelHeader from '../components/panelHeader';
import ProjectsStore from '../../../stores/projectsStore';
import Select2Field from '../components/forms/select2Field';
import TextBlock from '../components/text/textBlock';
import withOrganizations from '../../../utils/withOrganizations';

const ACCOUNT_NOTIFICATION_FIELDS = {
  alerts: {
    title: 'Project Alerts',
    description: t('Control alerts that you receive per project.'),
    type: 'select',
    choices: [[-1, t('Default')], [1, t('On')], [0, t('Off')]],
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
  },
  reports: {
    title: t('Weekly Reports'),
    description: t(
      "Reports contain a summary of what's happened within the organization."
    ),
    type: 'select',
    choices: [[1, t('On')], [0, t('Off')]],
  },
};

const PanelBodyLineItem = styled(PanelBody)`
  font-size: 1.4rem;
  border-bottom: 1px solid ${p => p.theme.borderLight};
`;

const isGroupedByProject = type => ['alerts', 'workflow'].indexOf(type) > -1;

class AccountNotificationsByProject extends React.Component {
  static propTypes = {
    projects: PropTypes.array,
    field: PropTypes.object,
  };

  getFieldData() {
    let {projects} = this.props;
    ProjectsStore.loadInitialData(projects);

    const projectsByOrg = ProjectsStore.getAllGroupedByOrganization();

    // eslint-disable-next-line no-unused-vars
    const {title, description, ...fieldConfig} = this.props.field;

    // Display as select box in this view regardless of the type specified in the config
    return Object.values(projectsByOrg).map(org => {
      return {
        name: org.organization.name,
        projects: org.projects.map(project => {
          return {
            ...fieldConfig,
            name: project.id,
            label: project.name,
          };
        }),
      };
    });
  }

  render() {
    const data = this.getFieldData();

    return data.map(org => {
      return (
        <div key={org.name}>
          <PanelHeader>{org.name}</PanelHeader>
          {org.projects.map(project => {
            return (
              <PanelBodyLineItem key={project.name}>
                <Select2Field
                  name={project.name}
                  choices={project.choices}
                  label={project.label}
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
        name: org.id,
        label: org.slug,
      };
    });
  }

  render() {
    const data = this.getFieldData();

    return data.map(org => {
      return (
        <PanelBodyLineItem key={org.id}>
          <Select2Field
            name={org.name}
            choices={org.choices}
            label={org.label}
            small={true}
          />
        </PanelBodyLineItem>
      );
    });
  }
}

const AccountNotificationsByOrganizationContainer = withOrganizations(
  AccountNotificationsByOrganization
);

export default class AccountNotificationFineTuning extends AsyncView {
  getEndpoints() {
    const {fineTuneType} = this.props.params;
    const endpoints = [['notifications', `/users/me/notifications/${fineTuneType}/`]];

    if (isGroupedByProject(fineTuneType)) {
      endpoints.push(['projects', '/projects/']);
    }

    return endpoints;
  }

  renderBody() {
    const {fineTuneType} = this.props.params;
    const isProject = isGroupedByProject(fineTuneType);
    const field = ACCOUNT_NOTIFICATION_FIELDS[fineTuneType];
    const {title, description} = field;

    return (
      <div>
        <Form
          saveOnBlur
          apiMethod="PUT"
          apiEndpoint={`/users/me/notifications/${this.props.params.fineTuneType}/`}
          initialData={this.state.notifications}
        >
          <Panel>
            <PanelHeader lightText={true}>{title}</PanelHeader>

            {description && <TextBlock>{description}</TextBlock>}

            {isProject && (
              <AccountNotificationsByProject
                {...this.props}
                {...this.state}
                field={field}
              />
            )}

            {!isProject && (
              <AccountNotificationsByOrganizationContainer
                {...this.props}
                {...this.state}
                field={field}
              />
            )}
          </Panel>
        </Form>
      </div>
    );
  }
}
