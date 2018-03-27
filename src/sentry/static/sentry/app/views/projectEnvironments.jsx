import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from '../actionCreators/indicator';
import {
  loadActiveEnvironments,
  loadHiddenEnvironments,
} from '../actionCreators/environments';
import {t, tct} from '../locale';
import {update} from '../actionCreators/projects';
import {Panel, PanelHeader, PanelBody, PanelItem} from '../components/panels';
import ApiMixin from '../mixins/apiMixin';
import Button from '../components/buttons/button';
import EmptyMessage from './settings/components/emptyMessage';
import EnvironmentStore from '../stores/environmentStore';
import IndicatorStore from '../stores/indicatorStore';
import ListLink from '../components/listLink';
import LoadingIndicator from '../components/loadingIndicator';
import SettingsPageHeader from './settings/components/settingsPageHeader';
import Tag from './settings/components/tag';
import recreateRoute from '../utils/recreateRoute';

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
          IndicatorStore.addSuccess(t('Update successful'));
        },
        error: err => {
          IndicatorStore.addError(t('An error occurred'));
        },
        complete: this.refetchAll,
      }
    );
  },

  // Changed "Default Environment"
  handleSetAsDefault(env) {
    const data = {defaultEnvironment: env.name};
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

  renderEnvironmentList(envs) {
    const {project, isHidden} = this.state;
    const buttonText = isHidden ? t('Show') : t('Hide');

    return envs.map(env => {
      const isDefault = project && env.name === project.defaultEnvironment;
      // Don't show "Set as default" button until project details are loaded
      const shouldShowSetDefault = !isHidden && !isDefault && project;
      return (
        <PanelItem key={env.id} align="center" justify="space-between">
          <Flex align="center">
            {env.displayName} {env.name && <code>{env.name}</code>}
            {isDefault && <Tag priority="success">{t('Default')}</Tag>}
          </Flex>
          <div>
            {shouldShowSetDefault && (
              <EnvironmentButton
                size="xsmall"
                onClick={this.handleSetAsDefault.bind(this, env)}
              >
                {t('Set as default')}
              </EnvironmentButton>
            )}

            <EnvironmentButton
              size="xsmall"
              onClick={() => this.toggleEnv(env, !isHidden)}
            >
              {buttonText}
            </EnvironmentButton>
          </div>
        </PanelItem>
      );
    });
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

const EnvironmentButton = styled(Button)`
  margin-left: 4px;
`;

export default ProjectEnvironments;
