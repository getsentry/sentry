import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import SentryTypes from 'app/sentryTypes';
import withProjects from 'app/utils/withProjects';

class IntegrationAlertRules extends React.Component {
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
        <PanelHeader disablePadding>
          <Box pl={2}>{t('Project Configuration')}</Box>
        </PanelHeader>
        <PanelBody>
          {projects.length === 0 && (
            <EmptyMessage size="large">
              {t('You have no projects to add Alert Rules to')}
            </EmptyMessage>
          )}
          {projects.map(project => (
            <PanelItem key={project.slug} align="center">
              <Box flex="1">
                <ProjectBadge project={project} avatarSize={16} />
              </Box>
              <Box pr={1}>
                <Button
                  to={`/settings/${orgId}/projects/${project.slug}/alerts/rules/new/`}
                  size="xsmall"
                >
                  {t('Add Alert Rule')}
                </Button>
              </Box>
            </PanelItem>
          ))}
        </PanelBody>
      </Panel>
    );
  }
}

export default withProjects(IntegrationAlertRules);
