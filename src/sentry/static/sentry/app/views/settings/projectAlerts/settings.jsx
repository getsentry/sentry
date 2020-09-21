import PropTypes from 'prop-types';
import React from 'react';

import {IconMail} from 'app/icons';
import {PanelAlert} from 'app/components/panels';
import {fields} from 'app/data/forms/projectAlerts';
import {t} from 'app/locale';
import AlertLink from 'app/components/alertLink';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import PluginList from 'app/components/pluginList';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import routeTitleGen from 'app/utils/routeTitle';

class ProjectAlertSettings extends AsyncView {
  static propTypes = {
    ...AsyncView.propTypes,
    // these are not declared as required of issues with cloned elements
    // not initially defining them (though they are bound before) ever
    // rendered
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    canEditRule: PropTypes.bool.isRequired,
  };

  getEndpoints() {
    const {orgId, projectId} = this.props.params;
    return [
      ['project', `/projects/${orgId}/${projectId}/`],
      ['pluginList', `/projects/${orgId}/${projectId}/plugins/`],
    ];
  }

  handleSaveSuccess = () => {};

  handleEnablePlugin = plugin => {
    this.setState({
      pluginList: this.state.pluginList.map(p => {
        if (p.id !== plugin.id) {
          return p;
        }
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
        if (p.id !== plugin.id) {
          return p;
        }
        return {
          ...plugin,
          enabled: false,
        };
      }),
    });
  };

  getTitle() {
    const {projectId} = this.props.params;
    return routeTitleGen(t('Alerts Settings'), projectId, false);
  }

  renderBody() {
    const {
      canEditRule,
      organization,
      params: {orgId, projectId},
    } = this.props;

    const {project} = this.state;

    return (
      <React.Fragment>
        <SettingsPageHeader
          title={t('Alerts Settings')}
          action={
            <Button
              to={{
                pathname: `/organizations/${orgId}/alerts/rules/`,
                query: {project: project.id},
              }}
              size="small"
            >
              {t('View Alert Rules')}
            </Button>
          }
        />
        <PermissionAlert />

        <AlertLink to="/settings/account/notifications/" icon={<IconMail />}>
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
          <JsonForm
            disabled={!canEditRule}
            title={t('Email Settings')}
            fields={[fields.subjectTemplate]}
          />

          <JsonForm
            title={t('Digests')}
            disabled={!canEditRule}
            fields={[fields.digestsMinDelay, fields.digestsMaxDelay]}
            renderHeader={() => (
              <PanelAlert type="info">
                {t(
                  'Sentry will automatically digest alerts sent by some services to avoid flooding your inbox with individual issue notifications. To control how frequently notifications are delivered, use the sliders below.'
                )}
              </PanelAlert>
            )}
          />
        </Form>

        {canEditRule && (
          <PluginList
            organization={organization}
            project={this.state.project}
            pluginList={this.state.pluginList.filter(
              p => p.type === 'notification' && p.hasConfiguration
            )}
            onEnablePlugin={this.handleEnablePlugin}
            onDisablePlugin={this.handleDisablePlugin}
          />
        )}
      </React.Fragment>
    );
  }
}

export default ProjectAlertSettings;
