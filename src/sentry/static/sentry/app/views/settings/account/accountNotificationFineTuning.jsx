import React from 'react';
import {css} from 'react-emotion';

import AsyncView from '../../asyncView';
import ApiForm from '../components/forms/apiForm';

import Select2Field from '../components/forms/select2Field';
import Panel from '../components/panel';
import PanelBody from '../components/panelBody';
import PanelHeader from '../components/panelHeader';

import ProjectsStore from '../../../stores/projectsStore';

const ACCOUNT_NOTIFICATION_FIELDS = {
  'project-alerts/': {
    name: 'subscribeByDefault',
    type: 'select',
    choices: [['default', 'Default'], ['on', 'On'], ['off', 'Off']],
  },
};

const lineCss = css`
  font-size: 1.4rem;
  border-bottom: 1px solid #ccc;
`;

export default class AccountNotificationDetails extends AsyncView {
  getEndpoints() {
    return [['notifications', '/users/me/notifications/'], ['projects', '/projects/']];
  }

  getFieldData(fieldName, projectList) {
    ProjectsStore.loadInitialData(projectList);

    const projectsByOrg = ProjectsStore.getAllGroupedByOrganization();

    const fieldConfig = ACCOUNT_NOTIFICATION_FIELDS[fieldName];

    // Display as select box in this view regardless of the type specified in the config
    return Object.values(projectsByOrg).map(org => {
      return {
        name: org.organization.name,
        projects: org.projects.map(project => {
          return {
            ...fieldConfig,
            name: project.slug,
            label: project.name,
          };
        }),
      };
    });
  }

  renderBody() {
    const {path} = this.props.route;
    const data = this.getFieldData(path, this.state.projects);

    return (
      <div>
        <ApiForm apiMethod="PUT" apiEndpoint={'/users/me/notifications/'}>
          <Panel>
            <PanelHeader>
              <div className="text-light">{this.props.route.name}</div>
            </PanelHeader>

            {data.map(org => {
              return (
                <div key={org.name}>
                  <PanelHeader>{org.name}</PanelHeader>
                  {org.projects.map((project, idx) => {
                    return (
                      <PanelBody key={idx} className={lineCss}>
                        <Select2Field
                          name={project.name}
                          choices={project.choices}
                          label={project.label}
                        />
                      </PanelBody>
                    );
                  })}
                </div>
              );
            })}
          </Panel>
        </ApiForm>
      </div>
    );
  }
}
