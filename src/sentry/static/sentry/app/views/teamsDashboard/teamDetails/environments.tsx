import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Panel, PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import space from 'app/styles/space';
import withProjects from 'app/utils/withProjects';
import {Project} from 'app/types';
import {IconFlag, IconSubtract} from 'app/icons';
import Tooltip from 'app/components/tooltip';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Button from 'app/components/button';

type Props = {
  projects: Project[];
};

class Environments extends React.Component<Props> {
  getEnvironments = (): Array<string> => {
    const {projects} = this.props;

    if (!Array.isArray(projects)) {
      return [];
    }

    const environments = projects.reduce((envs: Array<string>, currentProject) => {
      return [...envs, ...currentProject.environments];
    }, []);

    return Array.from(new Set(environments));
  };

  handleQueryUpdate = (event: React.ChangeEvent<HTMLInputElement>) => {
    // this.props.onQueryUpdate(event.target.value);
  };

  handleProjectSelected = (selectedProject: {value: string}) => {
    // const {unlinkedProjects} = this.props;
    // const project = unlinkedProjects.find(
    //   unlinkedProject => unlinkedProject.id === selectedProject.value
    // );
    // if (!project) {
    //   return;
    // }
    // this.handleLinkProject(project);
  };

  handleUnlinkProject = (environmentName: name) => async () => {
    // const {api, organization, teamSlug} = this.props;
    // try {
    //   await api.requestPromise(
    //     `/projects/${organization.slug}/${project.slug}/teams/${teamSlug}/`,
    //     {
    //       method: 'DELETE',
    //     }
    //   );
    //   addSuccessMessage(t('Successfully removed project from team.'));
    // } catch {
    //   addErrorMessage(t("Wasn't able to change project association."));
    // }
  };

  render() {
    console.log('this.props', this.props);

    const envs = this.getEnvironments();

    const canWrite = true;
    return (
      <Panel>
        <PanelHeader hasButtons>
          <div>{t('Environments')}</div>
          <div style={{textTransform: 'none'}}>
            {!canWrite ? (
              <DropdownButton
                disabled
                title={t(
                  'You do not have enough permission to associate an environment.'
                )}
                size="xsmall"
              >
                {t('Add Environment')}
              </DropdownButton>
            ) : (
              <DropdownAutoComplete
                items={envs.map((unlinkedEnv: string) => ({
                  value: unlinkedEnv,
                  searchKey: unlinkedEnv,
                  label: <UnlinkedProject>{unlinkedEnv}</UnlinkedProject>,
                }))}
                onChange={this.handleQueryUpdate}
                onSelect={this.handleProjectSelected}
                emptyMessage={t('No environments')}
              >
                {({isOpen}) => (
                  <DropdownButton isOpen={isOpen} size="xsmall">
                    {t('Add Environment')}
                  </DropdownButton>
                )}
              </DropdownAutoComplete>
            )}
          </div>
        </PanelHeader>
        <PanelBody>
          {envs.length ? (
            envs.map(environmentName => (
              <StyledPanelItem key={environmentName}>
                <div>{environmentName}</div>
                <Tooltip
                  disabled={canWrite}
                  title={t(
                    'You do not have enough permission to change environment association.'
                  )}
                >
                  <Button
                    size="small"
                    disabled={!canWrite}
                    icon={<IconSubtract isCircled size="xs" />}
                    onClick={this.handleUnlinkProject(environmentName)}
                  >
                    {t('Remove')}
                  </Button>
                </Tooltip>
              </StyledPanelItem>
            ))
          ) : (
            <EmptyMessage size="large" icon={<IconFlag size="xl" />}>
              {t('No environments')}
            </EmptyMessage>
          )}
        </PanelBody>
      </Panel>
    );
  }
}

const StyledPanelItem = styled(PanelItem)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(2)};
`;

const UnlinkedProject = styled('div')`
  padding: ${space(0.25)} 0;
`;

export default withProjects(Environments);
