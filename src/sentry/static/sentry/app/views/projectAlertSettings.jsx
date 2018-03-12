import React from 'react';

import {t} from '../locale';
import AlertLink from '../components/alertLink';
import AsyncView from './asyncView';
import Button from '../components/buttons/button';
import Form from './settings/components/forms/form';
import JsonForm from './settings/components/forms/jsonForm';
import ListLink from '../components/listLink';
import PanelAlert from './settings/components/panelAlert';
import PluginList from '../components/pluginList';
import SentryTypes from '../proptypes';
import SettingsPageHeader from './settings/components/settingsPageHeader';
import {fields} from '../data/forms/projectAlerts';
import recreateRoute from '../utils/recreateRoute';

export default class ProjectAlertSettings extends AsyncView {
  static propTypes = {
    ...AsyncView.propTypes,
    // these are not declared as required of issues with cloned elements
    // not initially defining them (though they are bound before) ever
    // rendered
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
  };

  getEndpoints() {
    let {orgId, projectId} = this.props.params;
    return [
      ['project', `/projects/${orgId}/${projectId}/`],
      ['pluginList', `/projects/${orgId}/${projectId}/plugins/`],
    ];
  }

  handleSaveSuccess = () => {};

  handleEnablePlugin = plugin => {
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

  handleDisablePlugin = plugin => {
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
              to={recreateRoute('rules/new/', this.props)}
              priority="primary"
              size="small"
              icon="icon-circle-add"
            >
              {t('New Alert Rule')}
            </Button>
          }
          tabs={
            <ul className="nav nav-tabs" style={{borderBottom: '1px solid #ddd'}}>
              <ListLink to={recreateRoute('', this.props)} index={true}>
                {t('Settings')}
              </ListLink>
              <ListLink to={recreateRoute('rules/', this.props)}>{t('Rules')}</ListLink>
            </ul>
          }
        />
        {/* TODO(ckj): change 'href' to 'to' when new settings is launched #NEW-SETTINGS */}
        <AlertLink href={'/account/settings/notifications/'} icon="icon-mail">
          {t(
            'Looking to fine-tune your personal notification preferences? Visit your Account Settings'
          )}
        </AlertLink>

        <Form
          saveOnBlur
          allowUndo
          initialData={{
            subjectTemplate: this.state.project.subjectTemplate,
            digestsMinDelay: this.state.project.digestsMinDelay,
            digestsMaxDelay: this.state.project.digestsMaxDelay,
          }}
          apiMethod="PUT"
          apiEndpoint={`/projects/${orgId}/${projectId}/`}
        >
          <JsonForm title={t('Email Settings')} fields={[fields.subjectTemplate]} />

          <JsonForm
            title={t('Digests')}
            fields={[fields.digestsMinDelay, fields.digestsMaxDelay]}
            renderHeader={() => (
              <PanelAlert m={0} mb={0} type="info" icon="icon-circle-exclamation">
                {t(
                  'Sentry will automatically digest alerts sent ' +
                    'by some services to avoid flooding your inbox ' +
                    'with individual issue notifications. To control ' +
                    'how frequently notifications are delivered, use ' +
                    'the sliders below.'
                )}
              </PanelAlert>
            )}
          />
        </Form>

        <PluginList
          organization={organization}
          project={this.state.project}
          pluginList={this.state.pluginList.filter(
            p => p.type === 'notification' && p.hasConfiguration
          )}
          onEnablePlugin={this.handleEnablePlugin}
          onDisablePlugin={this.handleDisablePlugin}
        />
      </div>
    );
  }
}
