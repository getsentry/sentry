import React from 'react';
import PropTypes from 'prop-types';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import EnvironmentStore from '../stores/environmentStore';
import Panel from './settings/components/panel';
import PanelHeader from './settings/components/panelHeader';
import PanelBody from './settings/components/panelBody';
import EmptyMessage from './settings/components/emptyMessage';
import {t} from '../locale';
import PanelItem from './settings/components/panelItem';
import Button from '../components/buttons/button';
import SettingsPageHeader from './settings/components/settingsPageHeader';
import ListLink from '../components/listLink';
import ApiMixin from '../mixins/apiMixin';

import LoadingIndicator from '../components/loadingIndicator';
import IndicatorStore from '../stores/indicatorStore';

import {
  loadActiveEnvironments,
  loadHiddenEnvironments,
} from '../actionCreators/environments';

const ProjectEnvironments = createReactClass({
  propTypes: {
    route: PropTypes.object,
    params: PropTypes.object,
  },
  mixins: [ApiMixin, Reflux.listenTo(EnvironmentStore, 'onEnvironmentsChange')],

  getInitialState() {
    const isHidden = this.props.route.path === 'environments/hidden/';
    const environments = isHidden
      ? EnvironmentStore.getHidden()
      : EnvironmentStore.getActive();

    return {
      environments,
      isHidden,
    };
  },

  componentDidMount() {
    if (this.state.environments === null) {
      this.fetchData(this.state.isHidden);
    }
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

  renderEmpty() {
    const {isHidden} = this.state;
    const message = isHidden
      ? t("You don't have any hidden environments.")
      : t("You don't have any environments yet.");
    return <EmptyMessage>{message}</EmptyMessage>;
  },

  renderEnvironmentList(envs) {
    const {isHidden} = this.state;
    const buttonText = isHidden ? t('Show') : t('Hide');
    return envs.map(env => (
      <PanelItem key={env.id} style={{justifyContent: 'space-between'}}>
        <span>{env.displayName}</span>
        <Button size="xsmall" onClick={() => this.toggleEnv(env, !isHidden)}>
          {buttonText}
        </Button>
      </PanelItem>
    ));
  },

  render() {
    const {environments} = this.state;
    const {orgId, projectId} = this.props.params;

    if (environments === null) {
      return <LoadingIndicator />;
    }

    return (
      <div>
        <SettingsPageHeader
          title={t('Manage Environments')}
          tabs={
            <ul className="nav nav-tabs" style={{borderBottom: '1px solid #ddd'}}>
              <ListLink to={`/${orgId}/${projectId}/settings/environments/`} index={true}>
                {t('Environments')}
              </ListLink>
              <ListLink
                to={`/${orgId}/${projectId}/settings/environments/hidden/`}
                index={true}
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

export default ProjectEnvironments;
