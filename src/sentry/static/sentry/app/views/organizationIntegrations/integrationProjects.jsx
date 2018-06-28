import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import {
  Panel,
  PanelAlert,
  PanelBody,
  PanelHeader,
  PanelItem,
} from 'app/components/panels';
import {
  addIntegrationToProject,
  removeIntegrationFromProject,
} from 'app/actionCreators/integrations';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/buttons/button';
import Confirm from 'app/components/confirm';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import withProjects from 'app/utils/withProjects';

class IntegrationProjects extends AsyncComponent {
  static propTypes = {
    integrationId: PropTypes.string.isRequired,
  };

  static contextTypes = {
    organization: PropTypes.object.isRequired,
  };

  constructor(props, context) {
    super(props, context);
    this.state = {adding: false};
  }

  getEndpoints() {
    const orgId = this.context.organization.slug;
    const {integrationId} = this.props;

    return [['integration', `/organizations/${orgId}/integrations/${integrationId}/`]];
  }

  removeProject = project => {
    const orgId = this.context.organization.slug;
    const {integration} = this.state;

    removeIntegrationFromProject(orgId, project, integration).then(() => {
      const projects = integration.projects.filter(p => p !== project);
      this.setState({integration: {...integration, projects}});
    });
  };

  addProject = ({value}) => {
    const project = value;
    const orgId = this.context.organization.slug;
    const {integration} = this.state;

    addIntegrationToProject(orgId, project, integration).then(() => {
      const intg = {...integration, projects: [...integration.projects, project]};
      this.setState({integration: intg});
    });
  };

  renderDropdown() {
    const enabled = new Set(this.context.organization.access).has('project:integrations');
    const items = this.props.projects
      .filter(p => !this.state.integration.projects.includes(p.slug))
      .map(p => ({
        searchKey: p.slug,
        value: p.slug,
        label: <ProjectBadge project={p} avatarSize={16} />,
      }));

    return (
      <DropdownAutoComplete
        items={items}
        onSelect={this.addProject}
        emptyMessage={t('Enabled for all projects')}
      >
        {({isOpen}) => (
          <DropdownButton
            size="xsmall"
            isOpen={isOpen}
            disabled={!enabled}
            busy={this.state.adding}
          >
            {t('Enable for Project')}
          </DropdownButton>
        )}
      </DropdownAutoComplete>
    );
  }

  renderBody() {
    const {integration} = this.state;
    const orgId = this.context.organization.slug;
    const projects = this.state.integration.projects.map(p => {
      return this.props.projects.find(pp => pp.slug === p);
    });

    return (
      <Panel>
        <PanelHeader disablePadding hasButtons>
          <Box pl={2}>{t('Projects')}</Box>
          <Box pr={1} style={{textTransform: 'none'}}>
            {this.renderDropdown()}
          </Box>
        </PanelHeader>
        <PanelAlert type="info">
          {t(
            'Adding the integration to a project will enable project specific ' +
              'integration functionality and configuration.'
          )}
        </PanelAlert>
        <PanelBody>
          {projects.length === 0 && (
            <EmptyMessage size="large">
              {t('Integration is not enabled for any Projects')}
            </EmptyMessage>
          )}
          {projects.map(project => (
            <PanelItem key={project.slug} align="center">
              <Box flex="1">
                <ProjectBadge project={project} avatarSize={16} />
              </Box>
              <Box pr={1}>
                <Button
                  to={`/settings/${orgId}/${project.slug}/integrations/${integration
                    .provider.key}/${integration.id}/`}
                  size="xsmall"
                >
                  {t('Configure')}
                </Button>
              </Box>
              <Box>
                <Confirm
                  onConfirm={() => this.removeProject(project.slug)}
                  message={
                    <React.Fragment>
                      <p>
                        <strong>
                          {t(
                            'Are you sure you want to remove the integration from %s?',
                            project.slug
                          )}
                        </strong>
                      </p>
                      <p>
                        {t(
                          'Removing the this integration from the project will clear any project specific configurations and functionality for this project.'
                        )}
                      </p>
                    </React.Fragment>
                  }
                >
                  <Button size="xsmall" icon="icon-trash" />
                </Confirm>
              </Box>
            </PanelItem>
          ))}
        </PanelBody>
      </Panel>
    );
  }
}

export default withProjects(IntegrationProjects);
