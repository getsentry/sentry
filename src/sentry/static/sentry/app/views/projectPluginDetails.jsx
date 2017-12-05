import React from 'react';
import AsyncView from './asyncView';
import {t} from '../locale';
import Button from '../components/buttons/button';
import PluginConfig from '../components/pluginConfig';
import ExternalLink from '../components/externalLink';
import IndicatorStore from '../stores/indicatorStore';

export default class ProjectPlugins extends AsyncView {
  getTitle() {
    let {plugin} = this.state;
    if (plugin && plugin.name) {
      return plugin.name;
    } else {
      return 'Sentry';
    }
  }

  getEndpoints() {
    let {projectId, orgId, pluginId} = this.props.params;
    return [['plugin', `/projects/${orgId}/${projectId}/plugins/${pluginId}/`]];
  }

  trimSchema(value) {
    return value.split('//')[1];
  }

  handleReset = () => {
    let {projectId, orgId, pluginId} = this.props.params;
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    this.api.request(`/projects/${orgId}/${projectId}/plugins/${pluginId}/reset/`, {
      method: 'POST',
      success: plugin => {
        this.setState({plugin});
        IndicatorStore.addSuccess(t('Plugin was reset'));
      },
      error: () => {
        IndicatorStore.addError(t('An error occurred'));
      },
      complete: () => IndicatorStore.remove(loadingIndicator),
    });
  };

  enable = () => {
    this.toggleEnable(true);
  };

  disable = () => {
    this.toggleEnable(false);
  };

  handleDisable = () => {
    this.setState(prevState => ({
      plugin: {
        ...prevState.plugin,
        enabled: false,
      },
    }));
  };

  toggleEnable(shouldEnable) {
    let method = shouldEnable ? 'POST' : 'DELETE';

    let {orgId, projectId, pluginId} = this.props.params;

    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));

    this.api.request(`/projects/${orgId}/${projectId}/plugins/${pluginId}/`, {
      method,
      success: () => {
        this.setState(prevState => ({
          plugin: {
            ...prevState.plugin,
            enabled: shouldEnable,
          },
        }));
        IndicatorStore.addSuccess(t('Plugin was updated'));
      },
      error: () => {
        IndicatorStore.addError(t('An error occurred'));
      },
      complete: () => IndicatorStore.remove(loadingIndicator),
    });
  }

  renderActions() {
    let {plugin} = this.state;

    let enable = (
      <Button onClick={this.enable} style={{marginRight: '6px'}}>
        {t('Enable Plugin')}
      </Button>
    );

    let disable = (
      <Button priority="danger" onClick={this.disable} style={{marginRight: '6px'}}>
        {t('Disable Plugin')}
      </Button>
    );

    let toggleEnable = plugin.enabled ? disable : enable;

    return (
      <div className="pull-right">
        {plugin.canDisable && toggleEnable}
        <Button onClick={this.handleReset}>{t('Reset Configuration')}</Button>
      </div>
    );
  }

  renderBody() {
    let {organization, project} = this.props;
    let {plugin} = this.state;

    return (
      <div>
        {this.renderActions()}
        <h2>{plugin.name}</h2>
        <hr />
        <div className="row">
          <div className="col-md-7">
            <PluginConfig
              organization={organization}
              project={project}
              data={plugin}
              onDisablePlugin={this.handleDisable}
            />
          </div>
          <div className="col-md-4 col-md-offset-1">
            <div className="plugin-meta">
              <h4>{t('Plugin Information')}</h4>

              <dl className="flat">
                <dt>{t('Name')}</dt>
                <dd>{plugin.name}</dd>
                <dt>{t('Author')}</dt>
                <dd>{plugin.author.name}</dd>
                {plugin.author.url && (
                  <div>
                    <dt>{t('URL')}</dt>
                    <dd>
                      <ExternalLink href={plugin.author.url}>
                        {this.trimSchema(plugin.author.url)}
                      </ExternalLink>
                    </dd>
                  </div>
                )}
                <dt>{t('Version')}</dt>
                <dd>{plugin.version}</dd>
              </dl>

              {plugin.description && (
                <div>
                  <h4>{t('Description')}</h4>
                  <p className="description">{plugin.description}</p>
                </div>
              )}

              {plugin.resourceLinks && (
                <div>
                  <h4>{t('Resources')}</h4>
                  <dl className="flat">
                    {plugin.resourceLinks.map(({title, url}) => (
                      <dd key={url}>
                        <ExternalLink href={url}>{title}</ExternalLink>
                      </dd>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
