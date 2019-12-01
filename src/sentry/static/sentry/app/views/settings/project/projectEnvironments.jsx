import {Flex} from 'reflexbox';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

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
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import recreateRoute from 'app/utils/recreateRoute';
import space from 'app/styles/space';
import {getUrlRoutingName, getDisplayName} from 'app/utils/environment';

class ProjectEnvironments extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    routes: PropTypes.array,
    params: PropTypes.object,
  };

  state = {
    project: null,
    environments: null,
    isLoading: true,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
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
  toggleEnv = (env, shouldHide) => {
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
        name={ALL_ENVIRONMENTS_KEY}
        environment={{
          id: ALL_ENVIRONMENTS_KEY,
          name: ALL_ENVIRONMENTS_KEY,
        }}
        isSystemRow
      />
    );
  }

  renderEnvironmentList(envs) {
    const isHidden = this.props.location.pathname.endsWith('hidden/');
    const buttonText = isHidden ? t('Show') : t('Hide');

    return (
      <React.Fragment>
        {this.renderAllEnvironmentsSystemRow()}
        {envs.map(env => {
          return (
            <EnvironmentRow
              key={env.id}
              name={env.name}
              environment={env}
              isHidden={isHidden}
              onHide={this.toggleEnv}
              actionText={buttonText}
              shouldShowAction
            />
          );
        })}
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
        {environments.length
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

class EnvironmentRow extends React.Component {
  static propTypes = {
    environment: SentryTypes.Environment,
    isHidden: PropTypes.bool,
    isSystemRow: PropTypes.bool,
    shouldShowAction: PropTypes.bool,
    actionText: PropTypes.string,
    onHide: PropTypes.func,
  };

  render() {
    const {environment, shouldShowAction, isSystemRow, isHidden, actionText} = this.props;

    return (
      <PanelItem alignItems="center" justifyContent="space-between">
        <Flex alignItems="center">
          {isSystemRow ? t('All Environments') : environment.name}
        </Flex>
        <Access access={['project:write']}>
          {({hasAccess}) => (
            <div>
              {shouldShowAction && (
                <EnvironmentButton
                  size="xsmall"
                  disabled={!hasAccess}
                  onClick={() => this.props.onHide(environment, !isHidden)}
                >
                  {actionText}
                </EnvironmentButton>
              )}
            </div>
          )}
        </Access>
      </PanelItem>
    );
  }
}
const EnvironmentButton = styled(Button)`
  margin-left: ${space(0.5)};
`;

export {ProjectEnvironments};
export default withApi(ProjectEnvironments);
