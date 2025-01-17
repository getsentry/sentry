import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {disablePlugin, enablePlugin} from 'sentry/actionCreators/plugins';
import {Button} from 'sentry/components/button';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import ExternalLink from 'sentry/components/links/externalLink';
import PluginConfig from 'sentry/components/pluginConfig';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Plugin} from 'sentry/types/integrations';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import getDynamicText from 'sentry/utils/getDynamicText';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import withPlugins from 'sentry/utils/withPlugins';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

type Props = {
  organization: Organization;
  plugins: {
    plugins: Plugin[];
  };
  project: Project;
} & RouteComponentProps<{pluginId: string; projectId: string}, {}>;

type State = {
  pluginDetails?: Plugin;
} & DeprecatedAsyncComponent['state'];

/**
 * There are currently two sources of truths for plugin details:
 *
 * 1) PluginsStore has a list of plugins, and this is where ENABLED state lives
 * 2) We fetch "plugin details" via API and save it to local state as `pluginDetails`.
 *    This is because "details" call contains form `config` and the "list" endpoint does not.
 *    The more correct way would be to pass `config` to PluginConfig and use plugin from
 *    PluginsStore
 */
class ProjectPluginDetails extends DeprecatedAsyncComponent<Props, State> {
  componentDidUpdate(prevProps: Props, prevState: State) {
    super.componentDidUpdate(prevProps, prevState);
    if (prevProps.params.pluginId !== this.props.params.pluginId) {
      this.recordDetailsViewed();
    }
  }
  componentDidMount() {
    super.componentDidMount();
    this.recordDetailsViewed();
  }

  recordDetailsViewed() {
    const {pluginId} = this.props.params;

    trackIntegrationAnalytics('integrations.details_viewed', {
      integration: pluginId,
      integration_type: 'plugin',
      view: 'plugin_details',
      organization: this.props.organization,
    });
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    const {projectId, pluginId} = this.props.params;
    return [
      [
        'pluginDetails',
        `/projects/${organization.slug}/${projectId}/plugins/${pluginId}/`,
      ],
    ];
  }

  trimSchema(value: any) {
    return value.split('//')[1];
  }

  handleReset = () => {
    const {organization} = this.props;
    const {projectId, pluginId} = this.props.params;

    addLoadingMessage(t('Saving changes\u2026'));
    trackIntegrationAnalytics('integrations.uninstall_clicked', {
      integration: pluginId,
      integration_type: 'plugin',
      view: 'plugin_details',
      organization: this.props.organization,
    });

    this.api.request(`/projects/${organization.slug}/${projectId}/plugins/${pluginId}/`, {
      method: 'POST',
      data: {reset: true},
      success: pluginDetails => {
        this.setState({pluginDetails});
        addSuccessMessage(t('Plugin was reset'));
        trackIntegrationAnalytics('integrations.uninstall_completed', {
          integration: pluginId,
          integration_type: 'plugin',
          view: 'plugin_details',
          organization: this.props.organization,
        });
      },
      error: () => {
        addErrorMessage(t('An error occurred'));
      },
    });
  };

  handleEnable = () => {
    const {organization, params} = this.props;
    enablePlugin({...params, orgId: organization.slug});
    this.analyticsChangeEnableStatus(true);
  };

  handleDisable = () => {
    const {organization, params} = this.props;
    disablePlugin({...params, orgId: organization.slug});
    this.analyticsChangeEnableStatus(false);
  };

  analyticsChangeEnableStatus = (enabled: boolean) => {
    const {pluginId} = this.props.params;
    const eventKey = enabled ? 'integrations.enabled' : 'integrations.disabled';
    trackIntegrationAnalytics(eventKey, {
      integration: pluginId,
      integration_type: 'plugin',
      view: 'plugin_details',
      organization: this.props.organization,
    });
  };

  // Enabled state is handled via PluginsStore and not via plugins detail
  getEnabled() {
    const {pluginDetails} = this.state;
    const {plugins} = this.props;

    const plugin = plugins?.plugins?.find(
      ({slug}) => slug === this.props.params.pluginId
    );

    return plugin ? plugin.enabled : pluginDetails?.enabled;
  }

  renderActions() {
    const {pluginDetails} = this.state;
    if (!pluginDetails) {
      return null;
    }
    const enabled = this.getEnabled();

    const enable = (
      <StyledButton size="sm" onClick={this.handleEnable}>
        {t('Enable Plugin')}
      </StyledButton>
    );

    const disable = (
      <StyledButton size="sm" priority="danger" onClick={this.handleDisable}>
        {t('Disable Plugin')}
      </StyledButton>
    );

    const toggleEnable = enabled ? disable : enable;

    return (
      <div className="pull-right">
        {pluginDetails.canDisable && toggleEnable}
        <Button size="sm" onClick={this.handleReset}>
          {t('Reset Configuration')}
        </Button>
      </div>
    );
  }

  renderBody() {
    const {project} = this.props;
    const {pluginDetails} = this.state;
    if (!pluginDetails) {
      return null;
    }

    return (
      <div>
        <SentryDocumentTitle title={pluginDetails.name} projectSlug={project.slug} />
        <SettingsPageHeader title={pluginDetails.name} action={this.renderActions()} />
        <div className="row">
          <div className="col-md-7">
            <PluginConfig
              project={project}
              plugin={pluginDetails}
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
                <dd>{pluginDetails.author?.name}</dd>
                {pluginDetails.author?.url && (
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
                <dd>
                  {getDynamicText({
                    value: pluginDetails.version,
                    fixed: '1.0.0',
                  })}
                </dd>
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

const StyledButton = styled(Button)`
  margin-right: ${space(0.75)};
`;
