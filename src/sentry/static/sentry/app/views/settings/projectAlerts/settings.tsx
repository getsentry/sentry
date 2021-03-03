import React from 'react';
import {RouteComponentProps} from 'react-router';

import AlertLink from 'app/components/alertLink';
import Button from 'app/components/button';
import {PanelAlert} from 'app/components/panels';
import PluginList from 'app/components/pluginList';
import {fields} from 'app/data/forms/projectAlerts';
import {IconMail} from 'app/icons';
import {t} from 'app/locale';
import {Organization, Plugin, Project} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import PermissionAlert from 'app/views/settings/project/permissionAlert';

type RouteParams = {orgId: string; projectId: string};
type Props = RouteComponentProps<RouteParams, {}> &
  AsyncView['props'] & {
    canEditRule: boolean;
    organization: Organization;
    project: Project;
  };

type State = AsyncView['state'] & {
  project: Project | null;
  pluginList: Array<Plugin> | null;
};

class Settings extends AsyncView<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      project: null,
      pluginList: [],
    };
  }
  getProjectEndpoint({orgId, projectId}: RouteParams) {
    return `/projects/${orgId}/${projectId}/`;
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {params} = this.props;
    const {orgId, projectId} = params;
    const projectEndpoint = this.getProjectEndpoint(params);
    return [
      ['project', projectEndpoint],
      ['pluginList', `/projects/${orgId}/${projectId}/plugins/`],
    ];
  }

  handleEnablePlugin = (plugin: Plugin) => {
    this.setState(prevState => ({
      pluginList: (prevState.pluginList ?? []).map(p => {
        if (p.id !== plugin.id) {
          return p;
        }
        return {
          ...plugin,
          enabled: true,
        };
      }),
    }));
  };

  handleDisablePlugin = (plugin: Plugin) => {
    this.setState(prevState => ({
      pluginList: (prevState.pluginList ?? []).map(p => {
        if (p.id !== plugin.id) {
          return p;
        }
        return {
          ...plugin,
          enabled: false,
        };
      }),
    }));
  };

  getTitle() {
    const {projectId} = this.props.params;
    return routeTitleGen(t('Alerts Settings'), projectId, false);
  }

  renderBody() {
    const {canEditRule, organization, params} = this.props;
    const {orgId} = params;
    const {project, pluginList} = this.state;

    if (!project) {
      return null;
    }

    const projectEndpoint = this.getProjectEndpoint(params);

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
            subjectTemplate: project.subjectTemplate,
            digestsMinDelay: project.digestsMinDelay,
            digestsMaxDelay: project.digestsMaxDelay,
          }}
          apiMethod="PUT"
          apiEndpoint={projectEndpoint}
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
            project={project}
            pluginList={(pluginList ?? []).filter(
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

export default Settings;
