import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import Access from 'sentry/components/acl/access';
import {Button} from 'sentry/components/core/button';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ALL_ENVIRONMENTS_KEY} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Environment, Project} from 'sentry/types/project';
import {getDisplayName, getUrlRoutingName} from 'sentry/utils/environment';
import recreateRoute from 'sentry/utils/recreateRoute';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

type Props = {
  api: Client;
  organization: Organization;
  project: Project;
} & RouteComponentProps<{projectId: string}>;

type State = {
  environments: null | Environment[];
  isLoading: boolean;
};

class ProjectEnvironments extends Component<Props, State> {
  state: State = {
    environments: null,
    isLoading: true,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.props.location.pathname.endsWith('hidden/') !==
      prevProps.location.pathname.endsWith('hidden/')
    ) {
      this.fetchData();
    }
  }

  fetchData() {
    const isHidden = this.props.location.pathname.endsWith('hidden/');

    if (!this.state.isLoading) {
      this.setState({isLoading: true});
    }

    const {organization} = this.props;
    const {projectId} = this.props.params;
    this.props.api.request(`/projects/${organization.slug}/${projectId}/environments/`, {
      query: {
        visibility: isHidden ? 'hidden' : 'visible',
      },
      success: environments => {
        this.setState({environments, isLoading: false});
      },
    });
  }

  // Toggle visibility of environment
  toggleEnv = (env: Environment, shouldHide: boolean) => {
    const {organization} = this.props;
    const {projectId} = this.props.params;

    this.props.api.request(
      `/projects/${organization.slug}/${projectId}/environments/${getUrlRoutingName(env)}/`,
      {
        method: 'PUT',
        data: {
          isHidden: shouldHide,
        },
        success: () => {
          addSuccessMessage(
            tct('Updated [environment]', {
              environment: getDisplayName(env),
            })
          );
        },
        error: () => {
          addErrorMessage(
            tct('Unable to update [environment]', {
              environment: getDisplayName(env),
            })
          );
        },
        complete: this.fetchData.bind(this),
      }
    );
  };

  renderEmpty() {
    const isHidden = this.props.location.pathname.endsWith('hidden/');
    const message = isHidden
      ? t("You don't have any hidden environments.")
      : t("You don't have any environments yet.");
    return <EmptyMessage>{message}</EmptyMessage>;
  }

  /**
   * Renders rows for "system" environments:
   * - "All Environments"
   * - "No Environment"
   *
   */
  renderAllEnvironmentsSystemRow() {
    // Not available in "Hidden" tab
    const isHidden = this.props.location.pathname.endsWith('hidden/');
    if (isHidden) {
      return null;
    }

    const {project} = this.props;
    return (
      <EnvironmentRow
        project={project}
        name={ALL_ENVIRONMENTS_KEY}
        environment={{
          id: ALL_ENVIRONMENTS_KEY,
          name: ALL_ENVIRONMENTS_KEY,
          displayName: ALL_ENVIRONMENTS_KEY,
        }}
        isSystemRow
      />
    );
  }

  renderEnvironmentList(envs: Environment[]) {
    const {project} = this.props;
    const isHidden = this.props.location.pathname.endsWith('hidden/');
    const buttonText = isHidden ? t('Show') : t('Hide');

    return (
      <Fragment>
        {this.renderAllEnvironmentsSystemRow()}
        {envs.map(env => (
          <EnvironmentRow
            project={project}
            key={env.id}
            name={env.name}
            environment={env}
            isHidden={isHidden}
            onHide={this.toggleEnv}
            actionText={buttonText}
            shouldShowAction
          />
        ))}
      </Fragment>
    );
  }

  renderBody() {
    const {environments, isLoading} = this.state;

    if (isLoading) {
      return <LoadingIndicator />;
    }

    return (
      <PanelBody>
        {environments?.length
          ? this.renderEnvironmentList(environments)
          : this.renderEmpty()}
      </PanelBody>
    );
  }

  render() {
    const {routes, params, location, project} = this.props;
    const isHidden = location.pathname.endsWith('hidden/');

    const baseUrl = recreateRoute('', {routes, params, stepBack: -1});
    return (
      <div>
        <SentryDocumentTitle title={t('Environments')} projectSlug={params.projectId} />
        <SettingsPageHeader
          title={t('Manage Environments')}
          tabs={
            <TabsContainer>
              <Tabs value={isHidden ? 'hidden' : 'environments'}>
                <TabList>
                  <TabList.Item key="environments" to={baseUrl}>
                    {t('Environments')}
                  </TabList.Item>
                  <TabList.Item key="hidden" to={`${baseUrl}hidden/`}>
                    {t('Hidden')}
                  </TabList.Item>
                </TabList>
              </Tabs>
            </TabsContainer>
          }
        />
        <ProjectPermissionAlert project={project} />

        <Panel>
          <PanelHeader>{isHidden ? t('Hidden') : t('Active Environments')}</PanelHeader>
          {this.renderBody()}
        </Panel>
      </div>
    );
  }
}

type RowProps = {
  environment: Environment;
  name: string;
  project: Project;
  actionText?: string;
  isHidden?: boolean;
  isSystemRow?: boolean;
  onHide?: (env: Environment, isHidden: boolean) => void;
  shouldShowAction?: boolean;
};

function EnvironmentRow({
  project,
  environment,
  name,
  onHide,
  shouldShowAction = false,
  isSystemRow = false,
  isHidden = false,
  actionText = '',
}: RowProps) {
  return (
    <EnvironmentItem>
      <Flex align="center">{isSystemRow ? t('All Environments') : name}</Flex>
      <Access access={['project:write']} project={project}>
        {({hasAccess}) => (
          <Fragment>
            {shouldShowAction && onHide && (
              <EnvironmentButton
                size="xs"
                disabled={!hasAccess}
                onClick={() => onHide(environment, !isHidden)}
              >
                {actionText}
              </EnvironmentButton>
            )}
          </Fragment>
        )}
      </Access>
    </EnvironmentItem>
  );
}

const EnvironmentItem = styled(PanelItem)`
  align-items: center;
  justify-content: space-between;
`;

const TabsContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

const EnvironmentButton = styled(Button)`
  margin-left: ${space(0.5)};
`;

export default function ProjectEnvironmentsWrapper() {
  const api = useApi();
  const location = useLocation();
  const params = useParams<{projectId: string}>();
  const routes = useRoutes();
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();

  return (
    <ProjectEnvironments
      api={api}
      location={location}
      params={params}
      routes={routes}
      organization={organization}
      project={project}
      router={undefined as any}
      route={undefined as any}
      routeParams={undefined as any}
    />
  );
}
