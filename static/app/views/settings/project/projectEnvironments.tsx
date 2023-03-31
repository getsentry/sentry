import {Component, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import Access from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import ListLink from 'sentry/components/links/listLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NavTabs from 'sentry/components/navTabs';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ALL_ENVIRONMENTS_KEY} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Environment, Organization, Project} from 'sentry/types';
import {getDisplayName, getUrlRoutingName} from 'sentry/utils/environment';
import recreateRoute from 'sentry/utils/recreateRoute';
import withApi from 'sentry/utils/withApi';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';

type Props = {
  api: Client;
  organization: Organization;
} & RouteComponentProps<{projectId: string}, {}>;

type State = {
  environments: null | Environment[];
  isLoading: boolean;
  project: null | Project;
};

class ProjectEnvironments extends Component<Props, State> {
  state: State = {
    project: null,
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

  fetchProjectDetails() {
    const {organization} = this.props;
    const {projectId} = this.props.params;
    this.props.api.request(`/projects/${organization.slug}/${projectId}/`, {
      success: project => {
        this.setState({project});
      },
    });
  }

  // Toggle visibility of environment
  toggleEnv = (env: Environment, shouldHide: boolean) => {
    const {organization} = this.props;
    const {projectId} = this.props.params;

    this.props.api.request(
      `/projects/${organization.slug}/${projectId}/environments/${getUrlRoutingName(
        env
      )}/`,
      {
        method: 'PUT',
        data: {
          name: env.name,
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
    return (
      <EnvironmentRow
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
    const isHidden = this.props.location.pathname.endsWith('hidden/');
    const buttonText = isHidden ? t('Show') : t('Hide');

    return (
      <Fragment>
        {this.renderAllEnvironmentsSystemRow()}
        {envs.map(env => (
          <EnvironmentRow
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
    const {routes, params, location} = this.props;
    const isHidden = location.pathname.endsWith('hidden/');

    const baseUrl = recreateRoute('', {routes, params, stepBack: -1});
    return (
      <div>
        <SentryDocumentTitle title={t('Environments')} projectSlug={params.projectId} />
        <SettingsPageHeader
          title={t('Manage Environments')}
          tabs={
            <NavTabs underlined>
              <ListLink to={baseUrl} index isActive={() => !isHidden}>
                {t('Environments')}
              </ListLink>
              <ListLink to={`${baseUrl}hidden/`} index isActive={() => isHidden}>
                {t('Hidden')}
              </ListLink>
            </NavTabs>
          }
        />
        <PermissionAlert />

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
  actionText?: string;
  isHidden?: boolean;
  isSystemRow?: boolean;
  onHide?: (env: Environment, isHidden: boolean) => void;
  shouldShowAction?: boolean;
};

function EnvironmentRow({
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
      <Name>{isSystemRow ? t('All Environments') : name}</Name>
      <Access access={['project:write']}>
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

const Name = styled('div')`
  display: flex;
  align-items: center;
`;

const EnvironmentButton = styled(Button)`
  margin-left: ${space(0.5)};
`;

export {ProjectEnvironments};
export default withApi(ProjectEnvironments);
