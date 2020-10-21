import React from 'react';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import {IconAdd} from 'app/icons';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import RepositoryProjectPathConfigRow from 'app/components/repositoryProjectPathConfigRow';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import space from 'app/styles/space';
import {t} from 'app/locale';
import withOrganization from 'app/utils/withOrganization';
import {
  Integration,
  Organization,
  Repository,
  RepositoryProjectPathConfig,
} from 'app/types';

type Props = AsyncComponent['props'] & {
  integration: Integration;
  organization: Organization;
};

type State = AsyncComponent['state'] & {
  repoProjectPathConfigs: RepositoryProjectPathConfig[];
  repos: Repository[];
};

class IntegrationCodeMappings extends AsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      repoProjectPathConfigs: [],
      repos: [],
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const orgSlug = this.props.organization.slug;
    return [
      [
        'repoProjectPathConfigs',
        `/organizations/${orgSlug}/integrations/${this.props.integration.id}/repo-project-path-configs/`,
      ],
      ['repos', `/organizations/${orgSlug}/repos/`, {query: {status: 'active'}}],
    ];
  }

  getMatchingRepo(repoProjectPathConfig: RepositoryProjectPathConfig) {
    return this.state.repos.find(repo => repo.id === repoProjectPathConfig.repoId);
  }

  getMatchingProject(repoProjectPathConfig: RepositoryProjectPathConfig) {
    return this.props.organization.projects.find(
      project => project.id === repoProjectPathConfig.projectId
    );
  }

  renderBody() {
    const {repoProjectPathConfigs} = this.state;
    const header = (
      <PanelHeader disablePadding hasButtons>
        <HeaderText>{t('Code Path Mappings')}</HeaderText>
        <ButtonWrapper>
          <AddButton size="xsmall" icon={<IconAdd size="xs" isCircled />}>
            {t('Add Mapping')}
          </AddButton>
        </ButtonWrapper>
      </PanelHeader>
    );

    return (
      <React.Fragment>
        <Panel>
          {header}
          <PanelBody>
            {repoProjectPathConfigs.length === 0 && (
              <EmptyMessage description={t('No code path mappings')} />
            )}
            {repoProjectPathConfigs
              .map(repoProjectPathConfig => {
                const repo = this.getMatchingRepo(repoProjectPathConfig);
                const project = this.getMatchingProject(repoProjectPathConfig);
                // this should never happen since our repoProjectPathConfig would be deleted
                // if the repo or project were deleted
                if (!repo || !project) {
                  return null;
                }
                return (
                  <RepositoryProjectPathConfigRow
                    key={repoProjectPathConfig.id}
                    repoProjectPathConfig={repoProjectPathConfig}
                    repo={repo}
                    project={project}
                  />
                );
              })
              .filter(item => !!item)}
          </PanelBody>
        </Panel>
      </React.Fragment>
    );
  }
}

export default withOrganization(IntegrationCodeMappings);

const HeaderText = styled('div')`
  padding-left: ${space(2)};
  flex: 1;
`;

const ButtonWrapper = styled('div')`
  padding-right: ${space(1)};
  text-transform: none;
`;

const AddButton = styled(Button)``;
