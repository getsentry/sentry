import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {ALL_ENVIRONMENTS_KEY} from 'app/constants';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import {
  loadActiveEnvironments,
  loadHiddenEnvironments,
} from 'app/actionCreators/environments';
import {t, tct} from 'app/locale';
import {update} from 'app/actionCreators/projects';
import {Panel, PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import ApiMixin from 'app/mixins/apiMixin';
import Button from 'app/components/buttons/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import EnvironmentStore from 'app/stores/environmentStore';
import InlineSvg from 'app/components/inlineSvg';
import ListLink from 'app/components/listLink';
import LoadingIndicator from 'app/components/loadingIndicator';
import SentryTypes from 'app/proptypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import Tag from 'app/views/settings/components/tag';
import Tooltip from 'app/components/tooltip';
import recreateRoute from 'app/utils/recreateRoute';

const ProjectEnvironments = createReactClass({
  propTypes: {
    route: PropTypes.object,
    routes: PropTypes.array,
    params: PropTypes.object,
  },

  mixins: [ApiMixin, Reflux.listenTo(EnvironmentStore, 'onEnvironmentsChange')],

  getInitialState() {
    const isHidden = this.props.route.path === 'environments/hidden/';
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
    const isHidden = nextProps.route.path === 'environments/hidden/';
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
    this.api.request(`/projects/${orgId}/${projectId}/environments/`, {
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
    this.api.request(`/projects/${orgId}/${projectId}/`, {
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

    this.api.request(
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
          addSuccessMessage(
            tct('Unable to update [environment]', {
              environment: env.displayName,
            })
          );
        },
        complete: this.refetchAll,
      }
    );
  },

  // Change "Default Environment"
  handleSetAsDefault(env) {
    const defaultEnvironment = env.name === ALL_ENVIRONMENTS_KEY ? null : env.name;

    const data = {defaultEnvironment};

    const oldProject = this.state.project;

    // Optimistically update state
    this.setState(state => ({
      ...state,
      project: {
        ...state.project,
        ...data,
      },
    }));

    addLoadingMessage();

    // Update project details
    update(this.api, {
      ...this.props.params,
      data,
    }).then(
      () => {
        addSuccessMessage(
          tct('Changed default environment to [environment]', {
            environment: env.displayName,
          })
        );
      },
      err => {
        // Error occurred, revert project state
        this.setState(state => ({
          ...state,
          project: oldProject,
        }));
        addErrorMessage(
          tct('Unable to change default environment to [environment]', {
            environment: env.displayName,
          })
        );
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
    if (this.state.isHidden) return null;
    let {project} = this.state;

    let isAllEnvironmentsDefault = project && project.defaultEnvironment === null;

    return (
      <EnvironmentRow
        name={ALL_ENVIRONMENTS_KEY}
        environment={{
          id: ALL_ENVIRONMENTS_KEY,
          displayName: t('All Environments'),
          name: ALL_ENVIRONMENTS_KEY,
        }}
        isSystemRow
        isDefault={isAllEnvironmentsDefault}
        shouldShowSetDefault={!isAllEnvironmentsDefault && !!project}
        onSetAsDefault={this.handleSetAsDefault}
      />
    );
  },

  // Renders current default environment IF it is not a valid environment
  renderInvalidDefaultEnvironment() {
    // Not available in "Hidden" tab
    if (this.state.isHidden) return null;
    let {environments, project} = this.state;
    // Default environment that is not a valid environment
    let isAllEnvironmentsDefault = project && project.defaultEnvironment === null;

    let hasOtherDefaultEnvironment =
      project &&
      environments &&
      !isAllEnvironmentsDefault &&
      !environments.find(({name}) => name === project.defaultEnvironment);

    if (!hasOtherDefaultEnvironment) return null;

    return (
      <EnvironmentRow
        name={project.defaultEnvironment}
        environment={{
          id: project.defaultEnvironment,
          displayName: (
            <React.Fragment>
              <Tooltip
                title={t('This is not an active environment')}
                tooltipOptions={{container: 'body'}}
              >
                <span css={{marginRight: 8}}>
                  <InvalidDefaultEnvironmentIcon />
                </span>
              </Tooltip>
              <code>{project.defaultEnvironment}</code>
            </React.Fragment>
          ),
          name: project.defaultEnvironment,
        }}
        isSystemRow
        isDefault
        shouldShowSetDefault={false}
        onSetAsDefault={this.handleSetAsDefault}
      />
    );
  },

  renderEnvironmentList(envs) {
    const {project, isHidden} = this.state;
    const buttonText = isHidden ? t('Show') : t('Hide');

    return (
      <React.Fragment>
        {this.renderSystemRows()}
        {envs.map(env => {
          const isDefault = project && env.name === project.defaultEnvironment;
          // Don't show "Set as default" button until project details are loaded
          const shouldShowSetDefault = !isHidden && !isDefault && !!project;
          return (
            <EnvironmentRow
              key={env.id}
              name={env.name}
              environment={env}
              isDefault={isDefault}
              isHidden={isHidden}
              shouldShowSetDefault={shouldShowSetDefault}
              onSetAsDefault={this.handleSetAsDefault}
              onHide={this.toggleEnv}
              actionText={buttonText}
              shouldShowAction
            />
          );
        })}
        {this.renderInvalidDefaultEnvironment()}
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
            <ul className="nav nav-tabs" style={{borderBottom: '1px solid #ddd'}}>
              <ListLink
                to={`${baseUrl}environments/`}
                index={true}
                isActive={() => !this.state.isHidden}
              >
                {t('Environments')}
              </ListLink>
              <ListLink
                to={`${baseUrl}environments/hidden/`}
                index={true}
                isActive={() => this.state.isHidden}
              >
                {t('Hidden')}
              </ListLink>
            </ul>
          }
        />

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
    isDefault: PropTypes.bool,
    isHidden: PropTypes.bool,
    isSystemRow: PropTypes.bool,
    shouldShowSetDefault: PropTypes.bool,
    shouldShowAction: PropTypes.bool,
    actionText: PropTypes.string,
    onSetAsDefault: PropTypes.func,
    onHide: PropTypes.func,
  };

  render() {
    let {
      environment,
      shouldShowSetDefault,
      shouldShowAction,
      isSystemRow,
      isDefault,
      isHidden,
      actionText,
    } = this.props;

    return (
      <PanelItem align="center" justify="space-between">
        <Flex align="center">
          {isSystemRow ? environment.displayName : environment.name}
          {isDefault && <Tag priority="success">{t('Default')}</Tag>}
        </Flex>
        <div>
          {shouldShowSetDefault && (
            <EnvironmentButton
              size="xsmall"
              onClick={() => this.props.onSetAsDefault(environment)}
            >
              {t('Set as default')}
            </EnvironmentButton>
          )}

          {shouldShowAction && (
            <EnvironmentButton
              size="xsmall"
              onClick={() => this.props.onHide(environment, !isHidden)}
            >
              {actionText}
            </EnvironmentButton>
          )}
        </div>
      </PanelItem>
    );
  }
}
const EnvironmentButton = styled(Button)`
  margin-left: 4px;
`;

const InvalidDefaultEnvironmentIcon = styled(props => (
  <InlineSvg src="icon-circle-exclamation" {...props} />
))`
  color: ${p => p.theme.error};
`;
export default ProjectEnvironments;
