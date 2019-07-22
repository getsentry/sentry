import React from 'react';

import {disablePlugin, enablePlugin} from 'app/actionCreators/plugins';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import ExternalLink from 'app/components/links/externalLink';
import IndicatorStore from 'app/stores/indicatorStore';
import PluginConfig from 'app/components/pluginConfig';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import withPlugins from 'app/utils/withPlugins';

import {DEPRECATED_PLUGINS} from './constants';

/**
 * There are currently two sources of truths for plugin details:
 *
 * 1) PluginsStore has a list of plugins, and this is where ENABLED state lives
 * 2) We fetch "plugin details" via API and save it to local state as `pluginDetails`.
 *    This is because "details" call contains form `config` and the "list" endpoint does not.
 *    The more correct way would be to pass `config` to PluginConfig and use plugin from
 *    PluginsStore
 */
class ProjectPluginDetails extends AsyncView {
  getTitle() {
    const {plugin} = this.state;
    if (plugin && plugin.name) {
      return plugin.name;
    } else {
      return 'Sentry';
    }
  }

  getEndpoints() {
    const {projectId, orgId, pluginId} = this.props.params;
    return [['pluginDetails', `/projects/${orgId}/${projectId}/plugins/${pluginId}/`]];
  }

  trimSchema(value) {
    return value.split('//')[1];
  }

  handleReset = () => {
    const {projectId, orgId, pluginId} = this.props.params;
    const loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    this.api.request(`/projects/${orgId}/${projectId}/plugins/${pluginId}/`, {
      method: 'POST',
      data: {reset: true},
      success: pluginDetails => {
        this.setState({pluginDetails});
        IndicatorStore.addSuccess(t('Plugin was reset'));
      },
      error: () => {
        IndicatorStore.addError(t('An error occurred'));
      },
      complete: () => IndicatorStore.remove(loadingIndicator),
    });
  };

  handleEnable = () => {
    enablePlugin(this.props.params);
  };

  handleDisable = () => {
    disablePlugin(this.props.params);
  };

  // Enabled state is handled via PluginsStore and not via plugins detail
  getEnabled() {
    const {pluginDetails} = this.state;
    const {plugins} = this.props;

    const plugin =
      plugins &&
      plugins.plugins &&
      plugins.plugins.find(({slug}) => slug === this.props.params.pluginId);

    return plugin ? plugin.enabled : pluginDetails && pluginDetails.enabled;
  }

  renderActions() {
    const {pluginDetails} = this.state;
    const enabled = this.getEnabled();
    const {pluginId} = this.props.params;

    const disabled = DEPRECATED_PLUGINS.includes(pluginId);

    const enable = (
      <Button
        disabled={disabled}
        size="small"
        onClick={this.handleEnable}
        style={{marginRight: '6px'}}
      >
        {t('Enable Plugin')}
      </Button>
    );

    const disable = (
      <Button
        size="small"
        priority="danger"
        onClick={this.handleDisable}
        style={{marginRight: '6px'}}
      >
        {t('Disable Plugin')}
      </Button>
    );

    const toggleEnable = enabled ? disable : enable;

    return (
      <div className="pull-right">
        {pluginDetails.canDisable && toggleEnable}
        <Button size="small" onClick={this.handleReset}>
          {t('Reset Configuration')}
        </Button>
      </div>
    );
  }

  renderBody() {
    const {organization, project} = this.props;
    const {pluginDetails} = this.state;

    return (
      <div>
        <SettingsPageHeader title={pluginDetails.name} action={this.renderActions()} />
        <div className="row">
          <div className="col-md-7">
            <PluginConfig
              organization={organization}
              project={project}
              data={pluginDetails}
              enabled={this.getEnabled()}
              onDisablePlugin={this.handleDisable}
            />
          </div>
          <div className="col-md-4 col-md-offset-1">
            <div className="pluginDetails-meta">
              <h4>{t('Plugin Information')}</h4>

              <dl className="flat">
                <dt>{t('Name')}</dt>
                <dd>{pluginDetails.name}</dd>
                <dt>{t('Author')}</dt>
                <dd>{pluginDetails.author.name}</dd>
                {pluginDetails.author.url && (
                  <div>
                    <dt>{t('URL')}</dt>
                    <dd>
                      <ExternalLink href={pluginDetails.author.url}>
                        {this.trimSchema(pluginDetails.author.url)}
                      </ExternalLink>
                    </dd>
                  </div>
                )}
                <dt>{t('Version')}</dt>
                <dd>{pluginDetails.version}</dd>
              </dl>

              {pluginDetails.description && (
                <div>
                  <h4>{t('Description')}</h4>
                  <p className="description">{pluginDetails.description}</p>
                </div>
              )}

              {pluginDetails.resourceLinks && (
                <div>
                  <h4>{t('Resources')}</h4>
                  <dl className="flat">
                    {pluginDetails.resourceLinks.map(({title, url}) => (
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

export {ProjectPluginDetails};

export default withPlugins(ProjectPluginDetails);
