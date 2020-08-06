import React from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {Panel, PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {sortProjects} from 'app/utils';
import {IconFlag, IconSubtract} from 'app/icons';
import {t} from 'app/locale';
import Button from 'app/components/button';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Pagination from 'app/components/pagination';
import ProjectListItem from 'app/views/settings/components/settingsProjectItem';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import {Project, Organization, Team} from 'app/types';

type Props = {
  api: Client;
  teamSlug: Team['slug'];
  projects: Array<Project>;
  unlinkedProjects: Array<Project>;
  organization: Organization;
  canWrite: boolean;
  pageLinks: string;
  onQueryUpdate: (query: string) => void;
  reloadData: () => void;
};

class Projects extends React.Component<Props> {
  handleProjectSelected = (selectedProject: {value: string}) => {
    const {unlinkedProjects} = this.props;

    const project = unlinkedProjects.find(
      unlinkedProject => unlinkedProject.id === selectedProject.value
    );

    if (!project) {
      return;
    }

    this.handleLinkProject(project);
  };

  handleLinkProject = async (project: Project) => {
    const {api, organization, teamSlug} = this.props;

    try {
      await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/teams/${teamSlug}/`,
        {
          method: 'POST',
        }
      );
      addSuccessMessage(t('Successfully added project to team.'));

      this.props.reloadData();
    } catch {
      addErrorMessage(t("Wasn't able to change project association."));
    }
  };

  handleUnlinkProject = (project: Project) => async () => {
    const {api, organization, teamSlug} = this.props;

    try {
      await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/teams/${teamSlug}/`,
        {
          method: 'DELETE',
        }
      );
      addSuccessMessage(t('Successfully removed project from team.'));

      this.props.reloadData();
    } catch {
      addErrorMessage(t("Wasn't able to change project association."));
    }
  };

  handleQueryUpdate = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.props.onQueryUpdate(event.target.value);
  };

  render() {
    const {projects, canWrite, organization, pageLinks, unlinkedProjects} = this.props;
    return (
      <React.Fragment>
        <Panel>
          <PanelHeader hasButtons>
            <div>{t('Projects')}</div>
            <div style={{textTransform: 'none'}}>
              {!canWrite ? (
                <DropdownButton
                  disabled
                  title={t('You do not have enough permission to associate a project.')}
                  size="xsmall"
                >
                  {t('Add Project')}
                </DropdownButton>
              ) : (
                <DropdownAutoComplete
                  items={unlinkedProjects.map(unlinkedProject => ({
                    value: unlinkedProject.id,
                    searchKey: unlinkedProject.slug,
                    label: <UnlinkedProject>{unlinkedProject.slug}</UnlinkedProject>,
                  }))}
                  onChange={this.handleQueryUpdate}
                  onSelect={this.handleProjectSelected}
                  emptyMessage={t('No projects')}
                >
                  {({isOpen}) => (
                    <DropdownButton isOpen={isOpen} size="xsmall">
                      {t('Add Project')}
                    </DropdownButton>
                  )}
                </DropdownAutoComplete>
              )}
            </div>
          </PanelHeader>
          <PanelBody>
            {projects.length ? (
              sortProjects(projects).map(project => (
                <StyledPanelItem key={project.id}>
                  <ProjectListItem project={project} organization={organization} />
                  <Tooltip
                    disabled={canWrite}
                    title={t(
                      'You do not have enough permission to change project association.'
                    )}
                  >
                    <Button
                      size="small"
                      disabled={!canWrite}
                      icon={<IconSubtract isCircled size="xs" />}
                      onClick={this.handleUnlinkProject(project)}
                    >
                      {t('Remove')}
                    </Button>
                  </Tooltip>
                </StyledPanelItem>
              ))
            ) : (
              <EmptyMessage size="large" icon={<IconFlag size="xl" />}>
                {t("This team doesn't have access to any projects.")}
              </EmptyMessage>
            )}
          </PanelBody>
        </Panel>
        <Pagination pageLinks={pageLinks} />
      </React.Fragment>
    );
  }
}

export default Projects;

const StyledPanelItem = styled(PanelItem)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(2)};
`;

const UnlinkedProject = styled('div')`
  padding: ${space(0.25)} 0;
`;
