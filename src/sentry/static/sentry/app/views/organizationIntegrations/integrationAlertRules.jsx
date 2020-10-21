import PropTypes from 'prop-types';
import {Component} from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import SentryTypes from 'app/sentryTypes';
import withProjects from 'app/utils/withProjects';

class IntegrationAlertRules extends Component {
  static propTypes = {
    projects: PropTypes.arrayOf(SentryTypes.Project).isRequired,
  };

  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  render() {
    const {projects} = this.props;
    const orgId = this.context.organization.slug;

    return (
      <Panel>
        <PanelHeader>{t('Project Configuration')}</PanelHeader>
        <PanelBody>
          {projects.length === 0 && (
            <EmptyMessage size="large">
              {t('You have no projects to add Alert Rules to')}
            </EmptyMessage>
          )}
          {projects.map(project => (
            <ProjectItem key={project.slug}>
              <ProjectBadge project={project} avatarSize={16} />
              <Button
                to={`/organizations/${orgId}/alerts/${project.slug}/new/`}
                size="xsmall"
              >
                {t('Add Alert Rule')}
              </Button>
            </ProjectItem>
          ))}
        </PanelBody>
      </Panel>
    );
  }
}

const ProjectItem = styled(PanelItem)`
  align-items: center;
  justify-content: space-between;
`;

export default withProjects(IntegrationAlertRules);
