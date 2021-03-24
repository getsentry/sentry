import React from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';
import * as qs from 'query-string';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {openModal} from 'app/actionCreators/modal';
import Alert from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import ExternalLink from 'app/components/links/externalLink';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import RepositoryProjectPathConfigForm from 'app/components/repositoryProjectPathConfigForm';
import RepositoryProjectPathConfigRow, {
  ButtonColumn,
  InputPathColumn,
  NameRepoColumn,
  OutputPathColumn,
} from 'app/components/repositoryProjectPathConfigRow';
import {IconAdd, IconInfo} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {
  Integration,
  Organization,
  Repository,
  RepositoryProjectPathConfig,
} from 'app/types';
import {getIntegrationIcon, trackIntegrationEvent} from 'app/utils/integrationUtil';
import withOrganization from 'app/utils/withOrganization';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import TextBlock from 'app/views/settings/components/text/textBlock';

type Props = AsyncComponent['props'] & {
  integration: Integration;
  organization: Organization;
};

type State = AsyncComponent['state'] & {
  pathConfigs: RepositoryProjectPathConfig[];
  repos: Repository[];
};

class IntegrationCodeMappings extends AsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      pathConfigs: [],
      repos: [],
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
        `/organizations/${orgSlug}/repo-project-path-configs/`,
        {query: {integrationId: this.integrationId}},
      ],
      ['repos', `/organizations/${orgSlug}/repos/`, {query: {status: 'active'}}],
    ];
  }

  getMatchingProject(pathConfig: RepositoryProjectPathConfig) {
    return this.projects.find(project => project.id === pathConfig.projectId);
  }

  componentDidMount() {
    const {referrer} = qs.parse(window.location.search) || {};
    // We don't start new session if the user was coming from choosing
    // the manual setup option flow from the issue details page
    const startSession = referrer === 'stacktrace-issue-details' ? false : true;
    trackIntegrationEvent(
      'integrations.code_mappings_viewed',
      {
        integration: this.props.integration.provider.key,
        integration_type: 'first_party',
      },
      this.props.organization,
      {startSession}
    );
  }

  handleDelete = async (pathConfig: RepositoryProjectPathConfig) => {
    const {organization} = this.props;
    const endpoint = `/organizations/${organization.slug}/repo-project-path-configs/${pathConfig.id}/`;
    try {
      await this.api.requestPromise(endpoint, {
        method: 'DELETE',
      });
      // remove config and update state
      let {pathConfigs} = this.state;
      pathConfigs = pathConfigs.filter(config => config.id !== pathConfig.id);
      this.setState({pathConfigs});
      addSuccessMessage(t('Deletion successful'));
    } catch {
      //no 4xx errors should happen on delete
      addErrorMessage(t('An error occurred'));
    }
  };

  handleSubmitSuccess = (pathConfig: RepositoryProjectPathConfig) => {
    trackIntegrationEvent(
      'integrations.stacktrace_complete_setup',
      {
        setup_type: 'manual',
        view: 'integration_configuration_detail',
        provider: this.props.integration.provider.key,
      },
      this.props.organization
    );
    let {pathConfigs} = this.state;
    pathConfigs = pathConfigs.filter(config => config.id !== pathConfig.id);
    // our getter handles the order of the configs
    pathConfigs = pathConfigs.concat([pathConfig]);
    this.setState({pathConfigs});
    this.setState({pathConfig: undefined});
  };

  openModal = (pathConfig?: RepositoryProjectPathConfig) => {
    const {organization, integration} = this.props;
    trackIntegrationEvent(
      'integrations.stacktrace_start_setup',
      {
        setup_type: 'manual',
        view: 'integration_configuration_detail',
        provider: this.props.integration.provider.key,
      },
      this.props.organization
    );

    openModal(({Body, Header, closeModal}) => (
      <React.Fragment>
        <Header closeButton>{t('Configure code path mapping')}</Header>
        <Body>
          <RepositoryProjectPathConfigForm
            organization={organization}
            integration={integration}
            projects={this.projects}
            repos={this.repos}
            onSubmitSuccess={config => {
              this.handleSubmitSuccess(config);
              closeModal();
            }}
            existingConfig={pathConfig}
            onCancel={closeModal}
          />
        </Body>
      </React.Fragment>
    ));
  };

  renderBody() {
    const pathConfigs = this.pathConfigs;
    const {integration} = this.props;

    return (
      <React.Fragment>
        <Alert type="info" icon={<IconInfo />}>
          {tct('Got feedback? Email [email:ecosystem-feedback@sentry.io].', {
            email: <a href="mailto:ecosystem-feedback@sentry.io" />,
          })}
        </Alert>
        <TextBlock>
          {tct(
            `Code Mappings are used to map stack trace file paths to source code file paths. These mappings are the basis for features like Stack Trace Linking. To learn more, [link: read the docs].`,
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/integrations/gitlab/#stack-trace-linking" />
              ),
            }
          )}
        </TextBlock>

        <Panel>
          <PanelHeader disablePadding hasButtons>
            <HeaderLayout>
              <NameRepoColumn>{t('Code Mappings')}</NameRepoColumn>
              <InputPathColumn>{t('Stack Trace Root')}</InputPathColumn>
              <OutputPathColumn>{t('Source Code Root')}</OutputPathColumn>
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
              <EmptyMessage
                icon={getIntegrationIcon(integration.provider.key, 'lg')}
                action={
                  <Button
                    href={`https://docs.sentry.io/product/integrations/${integration.provider.key}/#stack-trace-linking`}
                    size="small"
                    onClick={() => {
                      trackIntegrationEvent(
                        'integrations.stacktrace_docs_clicked',
                        {
                          view: 'integration_configuration_detail',
                          provider: this.props.integration.provider.key,
                        },
                        this.props.organization
                      );
                    }}
                  >
                    View Documentation
                  </Button>
                }
              >
                Set up stack trace linking by adding a code mapping.
              </EmptyMessage>
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
                        onEdit={this.openModal}
                        onDelete={this.handleDelete}
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
  grid-template-columns: 4.5fr 2.5fr 2.5fr 1.6fr;
  grid-template-areas: 'name-repo input-path output-path button';
`;

const HeaderLayout = styled(Layout)`
  align-items: center;
  margin: 0;
  margin-left: ${space(2)};
`;

const ConfigPanelItem = styled(PanelItem)``;
