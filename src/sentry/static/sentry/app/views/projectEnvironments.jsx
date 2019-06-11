import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {ALL_ENVIRONMENTS_KEY} from 'app/constants';
import {Panel, PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {
  loadActiveEnvironments,
  loadHiddenEnvironments,
} from 'app/actionCreators/environments';
import {t, tct} from 'app/locale';
import Access from 'app/components/acl/access';
import withApi from 'app/utils/withApi';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import EnvironmentStore from 'app/stores/environmentStore';
import ListLink from 'app/components/links/listLink';
import LoadingIndicator from 'app/components/loadingIndicator';
import NavTabs from 'app/components/navTabs';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import recreateRoute from 'app/utils/recreateRoute';
import space from 'app/styles/space';

const ProjectEnvironments = createReactClass({
  propTypes: {
    api: PropTypes.object,
    routes: PropTypes.array,
    params: PropTypes.object,
  },

  mixins: [Reflux.listenTo(EnvironmentStore, 'onEnvironmentsChange')],

  getInitialState() {
    const isHidden = this.props.location.pathname.endsWith('hidden/');
    const environments = isHidden
      ? EnvironmentStore.getHidden()
      : EnvironmentStore.getActive();

    return {
      project: null,
      environments,
      isHidden,
    };
  },

  componentDidMount() {
    if (this.state.environments === null) {
      this.fetchData(this.state.isHidden);
    }

    // Fetch project details instead of using project context to guarantee we have latest project details
    this.fetchProjectDetails();
  },

  componentWillReceiveProps(nextProps) {
    const isHidden = this.props.location.pathname.endsWith('hidden/');
    const environments = isHidden
      ? EnvironmentStore.getHidden()
      : EnvironmentStore.getActive();

    this.setState(
      {
        isHidden,
        environments,
      },
      () => {
        if (environments === null) {
          this.fetchData(isHidden);
        }
      }
    );
  },

  refetchAll() {
    this.fetchData(true);
    this.fetchData(false);
    this.fetchProjectDetails();
  },

  fetchData(hidden) {
    const {orgId, projectId} = this.props.params;
    this.props.api.request(`/projects/${orgId}/${projectId}/environments/`, {
      query: {
        visibility: hidden ? 'hidden' : 'visible',
      },
      success: env => {
        const load = hidden ? loadHiddenEnvironments : loadActiveEnvironments;
        load(env);
      },
    });
  },

  fetchProjectDetails() {
    const {orgId, projectId} = this.props.params;
    this.props.api.request(`/projects/${orgId}/${projectId}/`, {
      success: project => {
        this.setState({project});
      },
    });
  },

  onEnvironmentsChange() {
    const {isHidden} = this.state;

    this.setState({
      environments: isHidden
        ? EnvironmentStore.getHidden()
        : EnvironmentStore.getActive(),
    });
  },

  // Toggle visibility of environment
  toggleEnv(env, shouldHide) {
    const {orgId, projectId} = this.props.params;

    this.props.api.request(
      `/projects/${orgId}/${projectId}/environments/${env.urlRoutingName}/`,
      {
        method: 'PUT',
        data: {
          name: env.name,
          isHidden: shouldHide,
        },
        success: e => {
          addSuccessMessage(
            tct('Updated [environment]', {
              environment: env.displayName,
            })
          );
        },
        error: err => {
          addErrorMessage(
            tct('Unable to update [environment]', {
              environment: env.displayName,
            })
          );
        },
        complete: this.refetchAll,
      }
    );
  },

  renderEmpty() {
    const {isHidden} = this.state;
    const message = isHidden
      ? t("You don't have any hidden environments.")
      : t("You don't have any environments yet.");
    return <EmptyMessage>{message}</EmptyMessage>;
  },

  /**
   * Renders rows for "system" environments:
   * - "All Environments"
   * - "No Environment"
   *
   */
  renderSystemRows() {
    // Not available in "Hidden" tab
    if (this.state.isHidden) {
      return null;
    }
    return (
      <EnvironmentRow
        name={ALL_ENVIRONMENTS_KEY}
        environment={{
          id: ALL_ENVIRONMENTS_KEY,
          displayName: t('All Environments'),
          name: ALL_ENVIRONMENTS_KEY,
        }}
        isSystemRow
      />
    );
  },

  renderEnvironmentList(envs) {
    const {isHidden} = this.state;
    const buttonText = isHidden ? t('Show') : t('Hide');

    return (
      <React.Fragment>
        {this.renderSystemRows()}
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
  },

  render() {
    const {environments} = this.state;
    const {routes, params} = this.props;

    if (environments === null) {
      return <LoadingIndicator />;
    }

    const baseUrl = recreateRoute('', {routes, params, stepBack: -1});
    return (
      <div>
        <SettingsPageHeader
          title={t('Manage Environments')}
          tabs={
            <NavTabs underlined={true}>
              <ListLink to={baseUrl} index={true} isActive={() => !this.state.isHidden}>
                {t('Environments')}
              </ListLink>
              <ListLink
                to={`${baseUrl}hidden/`}
                index={true}
                isActive={() => this.state.isHidden}
              >
                {t('Hidden')}
              </ListLink>
            </NavTabs>
          }
        />
        <PermissionAlert />

        <Panel>
          <PanelHeader>
            {this.state.isHidden ? t('Hidden') : t('Active Environments')}
          </PanelHeader>

          <PanelBody>
            {environments.length
              ? this.renderEnvironmentList(environments)
              : this.renderEmpty()}
          </PanelBody>
        </Panel>
      </div>
    );
  },
});

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
      <PanelItem align="center" justify="space-between">
        <Flex align="center">
          {isSystemRow ? environment.displayName : environment.name}
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
