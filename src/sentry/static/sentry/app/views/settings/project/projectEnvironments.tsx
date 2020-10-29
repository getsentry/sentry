import React from 'react';
import styled from '@emotion/styled';
import {WithRouterProps} from 'react-router';

import {ALL_ENVIRONMENTS_KEY} from 'app/constants';
import {Panel, PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import Access from 'app/components/acl/access';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import withApi from 'app/utils/withApi';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ListLink from 'app/components/links/listLink';
import LoadingIndicator from 'app/components/loadingIndicator';
import NavTabs from 'app/components/navTabs';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import recreateRoute from 'app/utils/recreateRoute';
import space from 'app/styles/space';
import {getUrlRoutingName, getDisplayName} from 'app/utils/environment';
import {Environment, Project} from 'app/types';
import {Client} from 'app/api';

type Props = {
  api: Client;
} & WithRouterProps<{orgId: string; projectId: string}, {}>;

type State = {
  isLoading: boolean;
  project: null | Project;
  environments: null | Environment[];
};

class ProjectEnvironments extends React.Component<Props, State> {
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

    const {orgId, projectId} = this.props.params;
    this.props.api.request(`/projects/${orgId}/${projectId}/environments/`, {
      query: {
        visibility: isHidden ? 'hidden' : 'visible',
      },
      success: environments => {
        this.setState({environments, isLoading: false});
      },
    });
  }

  fetchProjectDetails() {
    const {orgId, projectId} = this.props.params;
    this.props.api.request(`/projects/${orgId}/${projectId}/`, {
      success: project => {
        this.setState({project});
      },
    });
  }

  // Toggle visibility of environment
  toggleEnv = (env: Environment, shouldHide: boolean) => {
    const {orgId, projectId} = this.props.params;

    this.props.api.request(
      `/projects/${orgId}/${projectId}/environments/${getUrlRoutingName(env)}/`,
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
      <React.Fragment>
        {this.renderAllEnvironmentsSystemRow()}
        {envs.map(env => (
          <EnvironmentRow
            key={env.id}
            environment={env}
            isHidden={isHidden}
            onHide={this.toggleEnv}
            actionText={buttonText}
            shouldShowAction
          />
        ))}
      </React.Fragment>
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
        <SentryDocumentTitle title={t('Environments')} objSlug={params.projectId} />
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
  onHide?: (env: Environment, isHidden: boolean) => void;
  isHidden?: boolean;
  actionText?: string;
  isSystemRow?: boolean;
  shouldShowAction?: boolean;
};

function EnvironmentRow({
  environment,
  onHide,
  shouldShowAction = false,
  isSystemRow = false,
  isHidden = false,
  actionText = '',
}: RowProps) {
  return (
    <EnvironmentItem>
      <Name>{isSystemRow ? t('All Environments') : environment.name}</Name>
      <Access access={['project:write']}>
        {({hasAccess}) => (
          <React.Fragment>
            {shouldShowAction && onHide && (
              <EnvironmentButton
                size="xsmall"
                disabled={!hasAccess}
                onClick={() => onHide(environment, !isHidden)}
              >
                {actionText}
              </EnvironmentButton>
            )}
          </React.Fragment>
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
