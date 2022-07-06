import {Fragment} from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';
import * as qs from 'query-string';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import Access from 'sentry/components/acl/access';
import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'sentry/components/panels';
import RepositoryProjectPathConfigForm from 'sentry/components/repositoryProjectPathConfigForm';
import RepositoryProjectPathConfigRow, {
  ButtonColumn,
  InputPathColumn,
  NameRepoColumn,
  OutputPathColumn,
} from 'sentry/components/repositoryProjectPathConfigRow';
import Tooltip from 'sentry/components/tooltip';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  Integration,
  Organization,
  Project,
  Repository,
  RepositoryProjectPathConfig,
} from 'sentry/types';
import {
  getIntegrationIcon,
  trackIntegrationAnalytics,
} from 'sentry/utils/integrationUtil';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = AsyncComponent['props'] & {
  integration: Integration;
  organization: Organization;
  projects: Project[];
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

  get pathConfigs() {
    // we want to sort by the project slug and the
    // id of the config
    return sortBy(this.state.pathConfigs, [
      ({projectSlug}) => projectSlug,
      ({id}) => parseInt(id, 10),
    ]);
  }

  get repos() {
    // endpoint doesn't support loading only the repos for this integration
    // but most people only have one source code repo so this should be fine
    return this.state.repos.filter(repo => repo.integrationId === this.integrationId);
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const orgSlug = this.props.organization.slug;
    return [
      [
        'pathConfigs',
        `/organizations/${orgSlug}/code-mappings/`,
        {query: {integrationId: this.integrationId}},
      ],
      ['repos', `/organizations/${orgSlug}/repos/`, {query: {status: 'active'}}],
    ];
  }

  getMatchingProject(pathConfig: RepositoryProjectPathConfig) {
    return this.props.projects.find(project => project.id === pathConfig.projectId);
  }

  componentDidMount() {
    const {referrer} = qs.parse(window.location.search) || {};
    // We don't start new session if the user was coming from choosing
    // the manual setup option flow from the issue details page
    const startSession = referrer === 'stacktrace-issue-details' ? false : true;
    trackIntegrationAnalytics(
      'integrations.code_mappings_viewed',
      {
        integration: this.props.integration.provider.key,
        integration_type: 'first_party',
        organization: this.props.organization,
      },
      {startSession}
    );
  }

  handleDelete = async (pathConfig: RepositoryProjectPathConfig) => {
    const {organization} = this.props;
    const endpoint = `/organizations/${organization.slug}/code-mappings/${pathConfig.id}/`;
    try {
      await this.api.requestPromise(endpoint, {
        method: 'DELETE',
      });
      // remove config and update state
      let {pathConfigs} = this.state;
      pathConfigs = pathConfigs.filter(config => config.id !== pathConfig.id);
      this.setState({pathConfigs});
      addSuccessMessage(t('Deletion successful'));
    } catch (err) {
      addErrorMessage(
        tct('[status]: [text]', {
          status: err.statusText,
          text: err.responseText,
        })
      );
    }
  };

  handleSubmitSuccess = (pathConfig: RepositoryProjectPathConfig) => {
    trackIntegrationAnalytics('integrations.stacktrace_complete_setup', {
      setup_type: 'manual',
      view: 'integration_configuration_detail',
      provider: this.props.integration.provider.key,
      organization: this.props.organization,
    });
    let {pathConfigs} = this.state;
    pathConfigs = pathConfigs.filter(config => config.id !== pathConfig.id);
    // our getter handles the order of the configs
    pathConfigs = pathConfigs.concat([pathConfig]);
    this.setState({pathConfigs});
    this.setState({pathConfig: undefined});
  };

  openModal = (pathConfig?: RepositoryProjectPathConfig) => {
    const {organization, projects, integration} = this.props;
    trackIntegrationAnalytics('integrations.stacktrace_start_setup', {
      setup_type: 'manual',
      view: 'integration_configuration_detail',
      provider: this.props.integration.provider.key,
      organization: this.props.organization,
    });

    openModal(({Body, Header, closeModal}) => (
      <Fragment>
        <Header closeButton>{t('Configure code path mapping')}</Header>
        <Body>
          <RepositoryProjectPathConfigForm
            organization={organization}
            integration={integration}
            projects={projects}
            repos={this.repos}
            onSubmitSuccess={config => {
              this.handleSubmitSuccess(config);
              closeModal();
            }}
            existingConfig={pathConfig}
            onCancel={closeModal}
          />
        </Body>
      </Fragment>
    ));
  };

  renderBody() {
    const pathConfigs = this.pathConfigs;
    const {integration} = this.props;

    return (
      <Fragment>
        <TextBlock>
          {tct(
            `Code Mappings are used to map stack trace file paths to source code file paths. These mappings are the basis for features like Stack Trace Linking. To learn more, [link: read the docs].`,
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/integrations/source-code-mgmt/gitlab/#stack-trace-linking" />
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

              <Access access={['org:integrations']}>
                {({hasAccess}) => (
                  <ButtonColumn>
                    <Tooltip
                      title={t(
                        'You must be an organization owner, manager or admin to edit or remove a code mapping.'
                      )}
                      disabled={hasAccess}
                    >
                      <Button
                        data-test-id="add-mapping-button"
                        onClick={() => this.openModal()}
                        size="xsmall"
                        icon={<IconAdd size="xs" isCircled />}
                        disabled={!hasAccess}
                      >
                        {t('Add Code Mapping')}
                      </Button>
                    </Tooltip>
                  </ButtonColumn>
                )}
              </Access>
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
                      trackIntegrationAnalytics('integrations.stacktrace_docs_clicked', {
                        view: 'integration_configuration_detail',
                        provider: this.props.integration.provider.key,
                        organization: this.props.organization,
                      });
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
      </Fragment>
    );
  }
}

export default withProjects(withOrganization(IntegrationCodeMappings));

const Layout = styled('div')`
  display: grid;
  grid-column-gap: ${space(1)};
  width: 100%;
  align-items: center;
  grid-template-columns: 4.5fr 2.5fr 2.5fr max-content;
  grid-template-areas: 'name-repo input-path output-path button';
`;

const HeaderLayout = styled(Layout)`
  align-items: center;
  margin: 0 ${space(1)} 0 ${space(2)};
`;

const ConfigPanelItem = styled(PanelItem)``;
