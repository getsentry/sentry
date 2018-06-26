import React from 'react';

import {PanelAlert} from 'app/components/panels';
import {fields} from 'app/data/forms/projectAlerts';
import {t} from 'app/locale';
import AlertLink from 'app/components/alertLink';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/buttons/button';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import ListLink from 'app/components/listLink';
import PluginList from 'app/components/pluginList';
import SentryTypes from 'app/proptypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import Tooltip from 'app/components/tooltip';
import recreateRoute from 'app/utils/recreateRoute';

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
    let canEditRule = organization.access.includes('project:write');

    return (
      <React.Fragment>
        <SettingsPageHeader
          title={t('Alerts')}
          action={
            <Tooltip
              disabled={canEditRule}
              title={t('You do not have permission to edit alert rules.')}
            >
              <Button
                to={recreateRoute('rules/new/', this.props)}
                disabled={!canEditRule}
                priority="primary"
                size="small"
                icon="icon-circle-add"
              >
                {t('New Alert Rule')}
              </Button>
            </Tooltip>
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
        <AlertLink to={'/settings/account/notifications/'} icon="icon-mail">
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
              <PanelAlert type="info">
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
      </React.Fragment>
    );
  }
}
