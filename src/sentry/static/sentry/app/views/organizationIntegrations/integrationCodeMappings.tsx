import React from 'react';
import styled from '@emotion/styled';
import Modal from 'react-bootstrap/lib/Modal';

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
import RepositoryProjectPathConfigForm from 'app/components/repositoryProjectPathConfigForm';
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
  pathConfigs: RepositoryProjectPathConfig[];
  repos: Repository[];
  showModal: boolean;
};

class IntegrationCodeMappings extends AsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      pathConfigs: [],
      repos: [],
      showModal: false,
    };
  }

  get projects() {
    return this.props.organization.projects;
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const orgSlug = this.props.organization.slug;
    return [
      [
        'pathConfigs',
        `/organizations/${orgSlug}/integrations/${this.props.integration.id}/repo-project-path-configs/`,
      ],
      ['repos', `/organizations/${orgSlug}/repos/`, {query: {status: 'active'}}],
    ];
  }

  getMatchingRepo(pathConfig: RepositoryProjectPathConfig) {
    return this.state.repos.find(repo => repo.id === pathConfig.repoId);
  }

  getMatchingProject(pathConfig: RepositoryProjectPathConfig) {
    return this.projects.find(project => project.id === pathConfig.projectId);
  }

  openModal = () => {
    this.setState({
      showModal: true,
    });
  };

  closeModal = () => {
    this.setState({
      showModal: false,
    });
  };

  renderBody() {
    const {organization, integration} = this.props;
    const {pathConfigs, showModal} = this.state;
    return (
      <React.Fragment>
        <Panel>
          <PanelHeader disablePadding hasButtons>
            <HeaderLayout>
              <NameRepoColumn>{t('Code Path Mappings')}</NameRepoColumn>
              <OutputPathColumn>{t('Output Path')}</OutputPathColumn>
              <InputPathColumn>{t('Input Path')}</InputPathColumn>
              <DefaultBranchColumn>{t('Branch')}</DefaultBranchColumn>
              <ButtonColumn>
                <AddButton
                  onClick={this.openModal}
                  size="xsmall"
                  icon={<IconAdd size="xs" isCircled />}
                >
                  {t('Add Mapping')}
                </AddButton>
              </ButtonColumn>
            </HeaderLayout>
          </PanelHeader>
          <PanelBody>
            {pathConfigs.length === 0 && (
              <EmptyMessage description={t('No code path mappings')} />
            )}
            {pathConfigs
              .map(pathConfig => {
                const repo = this.getMatchingRepo(pathConfig);
                const project = this.getMatchingProject(pathConfig);
                // this should never happen since our pathConfig would be deleted
                // if the repo or project were deleted
                if (!repo || !project) {
                  return null;
                }
                return (
                  <ConfigPanelItem key={pathConfig.id}>
                    <Layout>
                      <RepositoryProjectPathConfigRow
                        pathConfig={pathConfig}
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

        <Modal show={showModal} onHide={this.closeModal}>
          <Modal.Header>Header</Modal.Header>
          <Modal.Body>
            <RepositoryProjectPathConfigForm
              organization={organization}
              integration={integration}
              projects={this.projects}
            />
          </Modal.Body>
        </Modal>
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
