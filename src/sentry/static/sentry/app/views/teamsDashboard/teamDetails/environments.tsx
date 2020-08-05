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

import {TAB} from '../utils';
import withLocalStorage, {InjectedLocalStorageProps} from '../withLocalStorage';
import {ENVIRONMENT_KEY} from './utils';

type Props = InjectedLocalStorageProps & {
  teamSlug: string;
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

  handleQueryUpdate = (_event: React.ChangeEvent<HTMLInputElement>) => {
    // this.props.onQueryUpdate(event.target.value);
  };

  handleSelectEnvironment = (selectedEnvironment: {value: string}) => {
    const {setLs, getLs, teamSlug} = this.props;

    const teamData = getLs(teamSlug);

    const nextEnvironments = new Set([
      ...this.getSelectedEnvironments(),
      selectedEnvironment.value,
    ]);

    setLs(teamSlug, {...teamData, [ENVIRONMENT_KEY]: Array.from(nextEnvironments)});
  };

  handleUnlinkEnvironment = (environmentName: string) => async () => {
    const {setLs, getLs, teamSlug} = this.props;

    const teamData = getLs(teamSlug);

    const nextEnvironments = new Set(this.getSelectedEnvironments());
    nextEnvironments.delete(environmentName);

    setLs(teamSlug, {...teamData, [ENVIRONMENT_KEY]: Array.from(nextEnvironments)});
  };

  getSelectedEnvironments = (): Array<string> => {
    const {data, getLs, teamSlug} = this.props;

    if (!data) {
      return [];
    }

    const teamData = getLs(teamSlug);

    return teamData[ENVIRONMENT_KEY] ?? [];
  };

  getUnlinkedEnvironments = (): Array<string> => {
    const envs = this.getEnvironments();
    const selectedEnvs = new Set(this.getSelectedEnvironments());

    return envs.filter(env => {
      return !selectedEnvs.has(env);
    });
  };

  render() {
    const selectedEnvs = this.getSelectedEnvironments();

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
                items={this.getUnlinkedEnvironments().map((unlinkedEnv: string) => ({
                  value: unlinkedEnv,
                  searchKey: unlinkedEnv,
                  label: <UnlinkedProject>{unlinkedEnv}</UnlinkedProject>,
                }))}
                onChange={this.handleQueryUpdate}
                onSelect={this.handleSelectEnvironment}
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
          {selectedEnvs.length ? (
            selectedEnvs.map(environmentName => (
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
                    onClick={this.handleUnlinkEnvironment(environmentName)}
                  >
                    {t('Remove')}
                  </Button>
                </Tooltip>
              </StyledPanelItem>
            ))
          ) : (
            <EmptyMessage size="large" icon={<IconFlag size="xl" />}>
              {t('No environments selected for this team')}
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

export default withLocalStorage(withProjects(Environments), TAB.DASHBOARD);
