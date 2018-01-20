import PropTypes from 'prop-types';
import React from 'react';

import {ApiForm, RangeField, TextField} from '../components/forms';
import {t, tct} from '../locale';
import AsyncView from './asyncView';
import Button from '../components/buttons/button';
import ListLink from '../components/listLink';
import Panel from './settings/components/panel';
import PanelBody from './settings/components/panelBody';
import PanelHeader from './settings/components/panelHeader';
import PluginList from '../components/pluginList';
import SettingsPageHeader from './settings/components/settingsPageHeader';

class DigestSettings extends React.Component {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    initialData: PropTypes.object.isRequired,
    onSave: PropTypes.func.isRequired,
  };

  render() {
    let {orgId, projectId, initialData, onSave} = this.props;
    return (
      <Panel>
        <PanelHeader>{t('Digests')}</PanelHeader>
        <PanelBody px={2} pt={2} flex>
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
            requireChanges={true}
          >
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
        </PanelBody>
      </Panel>
    );
  }
}

class GeneralSettings extends React.Component {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    initialData: PropTypes.object,
    onSave: PropTypes.func.isRequired,
  };

  render() {
    let {orgId, projectId, initialData, onSave} = this.props;
    return (
      <Panel>
        <PanelHeader>{t('Email Settings')}</PanelHeader>

        <PanelBody px={2} pt={2} flex>
          <ApiForm
            onSubmitSuccess={onSave}
            apiMethod="PUT"
            apiEndpoint={`/projects/${orgId}/${projectId}/`}
            initialData={initialData}
            requireChanges={true}
          >
            <TextField
              name="subjectTemplate"
              label={t('Subject template')}
              required={false}
              help={t(
                'The email subject to use (excluding the prefix) for individual alerts. Usable variables include: $project, $title, $shortID, and ${tag:key}, such as ${tag:environment} or ${tag:release}.'
              )}
            />
          </ApiForm>
        </PanelBody>
      </Panel>
    );
  }
}

export default class ProjectAlertSettings extends AsyncView {
  static propTypes = {
    ...AsyncView.propTypes,
    // these are not declared as required of issues with cloned elements
    // not initially defining them (though they are bound before) ever
    // rendered
    organization: PropTypes.object,
    project: PropTypes.object,
  };

  getEndpoints() {
    let {orgId, projectId} = this.props.params;
    return [
      ['project', `/projects/${orgId}/${projectId}/`],
      ['pluginList', `/projects/${orgId}/${projectId}/plugins/`],
    ];
  }

  onDigestsChange = data => {
    // TODO(dcramer): propagate this in a more correct way
    this.setState({
      project: {
        ...this.state.project,
        ...data,
      },
    });
  };

  onGeneralChange = data => {
    // TODO(dcramer): propagate this in a more correct way
    this.setState({
      project: {
        ...this.state.project,
        ...data,
      },
    });
  };

  onEnablePlugin = plugin => {
    this.setState({
      pluginList: this.state.pluginList.map(p => {
        if (p.id !== plugin.id) return p;
        return {
          ...plugin,
          enabled: true,
        };
      }),
    });
  };

  onDisablePlugin = plugin => {
    this.setState({
      pluginList: this.state.pluginList.map(p => {
        if (p.id !== plugin.id) return p;
        return {
          ...plugin,
          enabled: false,
        };
      }),
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
        <SettingsPageHeader
          title={t('Alerts')}
          action={
            <Button
              to={`/${orgId}/${projectId}/settings/alerts/rules/new/`}
              priority="primary"
              size="small"
              className="pull-right"
            >
              <span className="icon-plus" />
              {t('New Alert Rule')}
            </Button>
          }
          tabs={
            <ul className="nav nav-tabs" style={{borderBottom: '1px solid #ddd'}}>
              <ListLink to={`/${orgId}/${projectId}/settings/alerts/`} index={true}>
                {t('Settings')}
              </ListLink>
              <ListLink to={`/${orgId}/${projectId}/settings/alerts/rules/`}>
                {t('Rules')}
              </ListLink>
            </ul>
          }
        />

        <div className="alert alert-block alert-info">
          {tct(
            "These settings cover rule-based alerts. If you're " +
              'looking to change which notifications you receive ' +
              'you may do so from your [link:account settings].',
            {
              link: <a href="/account/settings/notifications/" />,
            }
          )}
        </div>

        <GeneralSettings
          orgId={orgId}
          projectId={projectId}
          initialData={{
            subjectTemplate: this.state.project.subjectTemplate,
          }}
          onSave={this.onGeneralChange}
        />

        <DigestSettings
          orgId={orgId}
          projectId={projectId}
          initialData={{
            digestsMinDelay: this.state.project.digestsMinDelay,
            digestsMaxDelay: this.state.project.digestsMaxDelay,
          }}
          onSave={this.onDigestsChange}
        />

        <PluginList
          organization={organization}
          project={this.state.project}
          pluginList={this.state.pluginList.filter(
            p => p.type === 'notification' && p.hasConfiguration
          )}
          onEnablePlugin={this.onEnablePlugin}
          onDisablePlugin={this.onDisablePlugin}
        />
      </div>
    );
  }
}
