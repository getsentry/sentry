import React from 'react';
import styled from '@emotion/styled';
import Modal from 'react-bootstrap/lib/Modal';
import sortBy from 'lodash/sortBy';

import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import {IconAdd} from 'app/icons';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import RepositoryProjectPathConfigRow, {
  NameRepoColumn,
  OutputPathColumn,
  InputPathColumn,
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
  configInEdit?: RepositoryProjectPathConfig;
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

  get integrationId() {
    return this.props.integration.id;
  }

  get projects() {
    return this.props.organization.projects;
  }

  get pathConfigs() {
    // we want to sort by the project slug and the
    // id of the config
    return sortBy(this.state.pathConfigs, [
      ({projectSlug}) => projectSlug,
      ({id}) => parseInt(id, 10),
    ]);
  }

  get repos() {
    //endpoint doesn't support loading only the repos for this integration
    //but most people only have one source code repo so this should be fine
    return this.state.repos.filter(repo => repo.integrationId === this.integrationId);
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const orgSlug = this.props.organization.slug;
    return [
      [
        'pathConfigs',
        `/organizations/${orgSlug}/integrations/${this.integrationId}/repo-project-path-configs/`,
      ],
      ['repos', `/organizations/${orgSlug}/repos/`, {query: {status: 'active'}}],
    ];
  }

  getMatchingProject(pathConfig: RepositoryProjectPathConfig) {
    return this.projects.find(project => project.id === pathConfig.projectId);
  }

  openModal = (pathConfig?: RepositoryProjectPathConfig) => {
    this.setState({
      showModal: true,
      configInEdit: pathConfig,
    });
  };

  closeModal = () => {
    this.setState({
      showModal: false,
      pathConfig: undefined,
    });
  };

  handleEdit = (pathConfig: RepositoryProjectPathConfig) => {
    this.openModal(pathConfig);
  };

  handleSubmitSuccess = (pathConfig: RepositoryProjectPathConfig) => {
    let {pathConfigs} = this.state;
    // our getter handles the order of the configs
    pathConfigs = pathConfigs.concat([pathConfig]);
    this.setState({pathConfigs});
    this.closeModal();
  };

  renderBody() {
    const {organization, integration} = this.props;
    const {showModal, configInEdit} = this.state;
    const pathConfigs = this.pathConfigs;
    return (
      <React.Fragment>
        <Panel>
          <PanelHeader disablePadding hasButtons>
            <HeaderLayout>
              <NameRepoColumn>{t('Code Path Mappings')}</NameRepoColumn>
              <OutputPathColumn>{t('Output Path')}</OutputPathColumn>
              <InputPathColumn>{t('Input Path')}</InputPathColumn>
              <ButtonColumn>
                <AddButton
                  onClick={() => this.openModal()}
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
                const project = this.getMatchingProject(pathConfig);
                // this should never happen since our pathConfig would be deleted
                // if project was deleted
                if (!project) {
                  return null;
                }
                return (
                  <ConfigPanelItem key={pathConfig.id}>
                    <Layout>
                      <RepositoryProjectPathConfigRow
                        pathConfig={pathConfig}
                        project={project}
                        onEdit={this.handleEdit}
                      />
                    </Layout>
                  </ConfigPanelItem>
                );
              })
              .filter(item => !!item)}
          </PanelBody>
        </Panel>

        <Modal
          show={showModal}
          onHide={this.closeModal}
          enforceFocus={false}
          backdrop="static"
          animation={false}
        >
          <Modal.Header closeButton />
          <Modal.Body>
            <RepositoryProjectPathConfigForm
              organization={organization}
              integration={integration}
              projects={this.projects}
              repos={this.repos}
              onSubmitSuccess={this.handleSubmitSuccess}
              existingConfig={configInEdit}
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
  grid-template-columns: 4.5fr 2.5fr 2.5fr 1.6fr;
  grid-template-areas: 'name-repo output-path input-path button';
`;

const HeaderLayout = styled(Layout)`
  align-items: flex-end;
  margin: ${space(1)};
`;

const ConfigPanelItem = styled(PanelItem)``;
