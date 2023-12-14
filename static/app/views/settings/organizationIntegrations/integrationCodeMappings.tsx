import {Fragment} from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  Integration,
  Organization,
  Project,
  Repository,
  RepositoryProjectPathConfig,
} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import withRouteAnalytics, {
  WithRouteAnalyticsProps,
} from 'sentry/utils/routeAnalytics/withRouteAnalytics';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import RepositoryProjectPathConfigForm from './repositoryProjectPathConfigForm';
import RepositoryProjectPathConfigRow, {
  ButtonWrapper,
  InputPathColumn,
  NameRepoColumn,
  OutputPathColumn,
} from './repositoryProjectPathConfigRow';

type Props = DeprecatedAsyncComponent['props'] &
  WithRouteAnalyticsProps & {
    integration: Integration;
    organization: Organization;
    projects: Project[];
  };

type State = DeprecatedAsyncComponent['state'] & {
  pathConfigs: RepositoryProjectPathConfig[];
  repos: Repository[];
};

class IntegrationCodeMappings extends DeprecatedAsyncComponent<Props, State> {
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

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
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
    super.componentDidMount();
    this.props.setEventNames(
      'integrations.code_mappings_viewed',
      'Integrations: Code Mappings Viewed'
    );
    this.props.setRouteAnalyticsParams({
      integration: this.props.integration.provider.key,
      integration_type: 'first_party',
    });
  }

  trackDocsClick = () => {
    trackAnalytics('integrations.stacktrace_docs_clicked', {
      view: 'integration_configuration_detail',
      provider: this.props.integration.provider.key,
      organization: this.props.organization,
    });
  };

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
      addErrorMessage(`${err.statusText}: ${err.responseText}`);
    }
  };

  handleSubmitSuccess = (pathConfig: RepositoryProjectPathConfig) => {
    trackAnalytics('integrations.stacktrace_complete_setup', {
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
    trackAnalytics('integrations.stacktrace_start_setup', {
      setup_type: 'manual',
      view: 'integration_configuration_detail',
      provider: this.props.integration.provider.key,
      organization: this.props.organization,
    });

    openModal(({Body, Header, closeModal}) => (
      <Fragment>
        <Header closeButton>
          <h4>{t('Configure code path mapping')}</h4>
        </Header>
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

  /**
   * This is a workaround to paginate without affecting browserHistory or modifiying the URL
   * It's necessary because we don't want to affect the pagination state of other tabs on the page.
   */
  handleCursor: CursorHandler = async (cursor, _path, query, _direction) => {
    const orgSlug = this.props.organization.slug;
    const [pathConfigs, _, responseMeta] = await this.api.requestPromise(
      `/organizations/${orgSlug}/code-mappings/`,
      {includeAllArgs: true, query: {...query, cursor}}
    );
    this.setState({
      pathConfigs,
      pathConfigsPageLinks: responseMeta?.getResponseHeader('link'),
    });
  };

  getDocsLink(): string {
    /** Accounts for some asymmetry between docs links and provider keys */
    const {integration} = this.props;
    let docsKey = integration.provider.key;
    switch (integration.provider.key) {
      case 'vsts':
        docsKey = 'azure-devops';
        break;
      case 'github_enterprise':
        docsKey = 'github';
        break;
      default:
        docsKey = integration.provider.key;
        break;
    }
    return `https://docs.sentry.io/product/integrations/source-code-mgmt/${docsKey}/#stack-trace-linking`;
  }

  renderBody() {
    const pathConfigs = this.pathConfigs;
    const {integration} = this.props;
    const {pathConfigsPageLinks} = this.state;
    const docsLink = this.getDocsLink();

    return (
      <Fragment>
        <TextBlock>
          {tct(
            `Code Mappings are used to map stack trace file paths to source code file paths. These mappings are the basis for features like Stack Trace Linking. To learn more, [link: read the docs].`,
            {
              link: <ExternalLink href={docsLink} onClick={this.trackDocsClick} />,
            }
          )}
        </TextBlock>

        <Panel>
          <PanelHeader disablePadding hasButtons>
            <HeaderLayout>
              <NameRepoColumn>{t('Code Mappings')}</NameRepoColumn>
              <InputPathColumn>{t('Stack Trace Root')}</InputPathColumn>
              <OutputPathColumn>{t('Source Code Root')}</OutputPathColumn>
              <ButtonWrapper>
                <Button
                  data-test-id="add-mapping-button"
                  onClick={() => this.openModal()}
                  size="xs"
                  icon={<IconAdd isCircled />}
                >
                  {t('Add Code Mapping')}
                </Button>
              </ButtonWrapper>
            </HeaderLayout>
          </PanelHeader>
          <PanelBody>
            {pathConfigs.length === 0 && (
              <EmptyMessage
                icon={getIntegrationIcon(integration.provider.key, 'lg')}
                action={
                  <Button
                    href={docsLink}
                    size="sm"
                    external
                    onClick={this.trackDocsClick}
                  >
                    {t('View Documentation')}
                  </Button>
                }
              >
                {t('Set up stack trace linking by adding a code mapping.')}
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
        {pathConfigsPageLinks && (
          <Pagination pageLinks={pathConfigsPageLinks} onCursor={this.handleCursor} />
        )}
      </Fragment>
    );
  }
}

export default withRouteAnalytics(
  withProjects(withOrganization(IntegrationCodeMappings))
);

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
