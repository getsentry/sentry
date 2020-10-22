import React from 'react';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import {IconAdd} from 'app/icons';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import RepositoryProjectPathConfigRow, {
  NameRepoColumn,
  OutputPathColumn,
  InputPathColumn,
  DefaultBranchColumn,
  ButtonColumn,
} from 'app/components/repositoryProjectPathConfigRow';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
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
    return (
      <React.Fragment>
        <Panel>
          <PanelHeader disablePadding hasButtons>
            <HeaderLayout>
              <NameRepoColumn>{t('Code Path Mappings')}</NameRepoColumn>
              <OutputPathColumn>{t('Output Path')}</OutputPathColumn>
              <InputPathColumn>{t('Input Path')}</InputPathColumn>
              <DefaultBranchColumn>{t('Default Branch')}</DefaultBranchColumn>
              <ButtonColumn>
                <AddButton size="xsmall" icon={<IconAdd size="xs" isCircled />}>
                  {t('Add Mapping')}
                </AddButton>
              </ButtonColumn>
            </HeaderLayout>
          </PanelHeader>
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
                  <ConfigPanelItem key={repoProjectPathConfig.id}>
                    <Layout>
                      <RepositoryProjectPathConfigRow
                        repoProjectPathConfig={repoProjectPathConfig}
                        repo={repo}
                        project={project}
                      />
                    </Layout>
                  </ConfigPanelItem>
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

const AddButton = styled(Button)``;

const Layout = styled('div')`
  display: grid;
  grid-column-gap: ${space(1)};
  width: 100%;
  align-items: center;
  grid-template-columns: 4fr 2fr 2fr 1.2fr 1.5fr;
  grid-template-areas: 'name-repo output-path input-path default-branch button';
`;

const HeaderLayout = styled(Layout)`
  align-items: flex-end;
  margin: ${space(1)};
`;

const ConfigPanelItem = styled(PanelItem)``;
