import React from 'react';

import AsyncView from './asyncView';
import ListLink from '../components/listLink';
import PluginList from '../components/pluginList';
import {ApiForm, RangeField, TextField} from '../components/forms';
import {t, tct} from '../locale';

class DigestSettings extends React.Component {
  static propTypes = {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    initialData: React.PropTypes.object.isRequired,
    onSave: React.PropTypes.func.isRequired
  };

  render() {
    let {orgId, projectId, initialData, onSave} = this.props;
    return (
      <div className="box">
        <div className="box-header">
          <h3>{t('Digests')}</h3>
        </div>
        <div className="box-content with-padding">
          <p>
            {t(
              'Sentry will automatically digest alerts sent ' +
                'by some services to avoid flooding your inbox ' +
                'with individual issue notifications. To control ' +
                'how frequently notifications are delivered, use ' +
                'the sliders below.'
            )}
          </p>
          <ApiForm
            onSubmitSuccess={onSave}
            apiMethod="PUT"
            apiEndpoint={`/projects/${orgId}/${projectId}/`}
            initialData={initialData}
            requireChanges={true}>
            <div className="row">
              <div className="col-md-6">
                <RangeField
                  min={60}
                  max={3600}
                  step={60}
                  defaultValue={300}
                  label={t('Minimum delivery interval')}
                  help={t('Notifications will be delivered at most this often.')}
                  name="digestsMinDelay"
                  formatLabel={RangeField.formatMinutes}
                />
              </div>
              <div className="col-md-6">
                <RangeField
                  min={60}
                  max={3600}
                  step={60}
                  defaultValue={3600}
                  label={t('Maximum delivery interval')}
                  help={t('Notifications will be delivered at least this often.')}
                  name="digestsMaxDelay"
                  formatLabel={RangeField.formatMinutes}
                />
              </div>
            </div>
          </ApiForm>
        </div>
      </div>
    );
  }
}

class GeneralSettings extends React.Component {
  static propTypes = {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    initialData: React.PropTypes.object,
    onSave: React.PropTypes.func.isRequired
  };

  render() {
    let {orgId, projectId, initialData, onSave} = this.props;
    return (
      <div className="box">
        <div className="box-header">
          <h3>{t('Email Settings')}</h3>
        </div>

        <div className="box-content with-padding">
          <ApiForm
            onSubmitSuccess={onSave}
            apiMethod="PUT"
            apiEndpoint={`/projects/${orgId}/${projectId}/`}
            initialData={initialData}
            requireChanges={true}>
            <TextField
              name="subjectTemplate"
              label={t('Subject template')}
              required={false}
              help={t(
                'The email subject to use (excluding the prefix) for individual alerts. Usable variables include: $project, $title, and ${tag:key}, such as ${tag:environment} or ${tag:release}.'
              )}
            />
          </ApiForm>
        </div>
      </div>
    );
  }
}

export default class ProjectAlertSettings extends AsyncView {
  static propTypes = {
    ...AsyncView.propTypes,
    // these are not declared as required of issues with cloned elements
    // not initially defining them (though they are bound before) ever
    // rendered
    organization: React.PropTypes.object,
    project: React.PropTypes.object
  };

  getEndpoints() {
    let {orgId, projectId} = this.props.params;
    return [
      ['project', `/projects/${orgId}/${projectId}/`],
      ['pluginList', `/projects/${orgId}/${projectId}/plugins/`]
    ];
  }

  onDigestsChange = data => {
    // TODO(dcramer): propagate this in a more correct way
    this.setState({
      project: {
        ...this.state.project,
        ...data
      }
    });
  };

  onGeneralChange = data => {
    // TODO(dcramer): propagate this in a more correct way
    this.setState({
      project: {
        ...this.state.project,
        ...data
      }
    });
  };

  onEnablePlugin = plugin => {
    this.setState({
      pluginList: this.state.pluginList.map(p => {
        if (p.id !== plugin.id) return p;
        return {
          ...plugin,
          enabled: true
        };
      })
    });
  };

  onDisablePlugin = plugin => {
    this.setState({
      pluginList: this.state.pluginList.map(p => {
        if (p.id !== plugin.id) return p;
        return {
          ...plugin,
          enabled: false
        };
      })
    });
  };

  getTitle() {
    return 'Project Alert Settings';
  }

  renderBody() {
    let {orgId, projectId} = this.props.params;
    let {organization} = this.props;
    return (
      <div>
        <a
          href={`/${orgId}/${projectId}/settings/alerts/rules/new/`}
          className="btn pull-right btn-primary btn-sm">
          <span className="icon-plus" />
          {t('New Alert Rule')}
        </a>
        <h2>{t('Alerts')}</h2>

        <ul className="nav nav-tabs" style={{borderBottom: '1px solid #ddd'}}>
          <ListLink to={`/${orgId}/${projectId}/settings/alerts/`} index={true}>
            {t('Settings')}
          </ListLink>
          <ListLink to={`/${orgId}/${projectId}/settings/alerts/rules/`}>
            {t('Rules')}
          </ListLink>
        </ul>

        <div className="alert alert-block alert-info">
          {tct(
            "These settings cover rule-based alerts. If you're " +
              'looking to change which notifications you receive ' +
              'you may do so from your [link:account settings].',
            {
              link: <a href="/account/settings/notifications/" />
            }
          )}
        </div>

        <GeneralSettings
          orgId={orgId}
          projectId={projectId}
          initialData={{
            subjectTemplate: this.state.project.subjectTemplate
          }}
          onSave={this.onGeneralChange}
        />

        <DigestSettings
          orgId={orgId}
          projectId={projectId}
          initialData={{
            digestsMinDelay: this.state.project.digestsMinDelay,
            digestsMaxDelay: this.state.project.digestsMaxDelay
          }}
          onSave={this.onDigestsChange}
        />

        <PluginList
          organization={organization}
          project={this.state.project}
          pluginList={this.state.pluginList.filter(p => p.type === 'notification')}
          onEnablePlugin={this.onEnablePlugin}
          onDisablePlugin={this.onDisablePlugin}
        />
      </div>
    );
  }
}
