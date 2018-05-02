import PropTypes from 'prop-types';
import React from 'react';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import AutoSelectText from 'app/components/autoSelectText';
import Button from 'app/components/buttons/button';
import Confirm from 'app/components/confirm';
import DynamicWrapper from 'app/components/dynamicWrapper';
import getDynamicText from 'app/utils/getDynamicText';
import Field from 'app/views/settings/components/forms/field';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import PluginList from 'app/components/pluginList';
import SentryTypes from 'app/proptypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import withPlugins from 'app/utils/withPlugins';

class ProjectReleaseTracking extends AsyncView {
  static propTypes = {
    organization: PropTypes.object,
    project: PropTypes.object,
    plugins: SentryTypes.PluginsStore,
  };

  getTitle() {
    return 'Release Tracking';
  }

  getEndpoints() {
    let {orgId, projectId} = this.props.params;

    return [['data', `/projects/${orgId}/${projectId}/releases/token/`]];
  }

  handleRegenerateToken = () => {
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/releases/token/`, {
      method: 'POST',
      data: {project: projectId},
      success: data => {
        this.setState({
          token: data.token,
          webhookUrl: data.webhookUrl,
        });
        addSuccessMessage(
          t(
            'Your deploy token has been regenerated. You will need to update any existing deploy hooks.'
          )
        );
      },
      error: () => {
        addErrorMessage(t('Unable to regenerate deploy token, please try again'));
      },
    });
  };

  getReleaseWebhookIntructions() {
    let {webhookUrl} = this.state.data;
    return (
      'curl ' +
      webhookUrl +
      ' \\' +
      '\n  ' +
      '-X POST \\' +
      '\n  ' +
      "-H 'Content-Type: application/json' \\" +
      '\n  ' +
      '-d \'{"version": "abcdefg"}\''
    );
  }

  getReleaseClientConfigurationIntructions() {
    return (
      '// See SDK documentation for language specific usage.' +
      '\n' +
      "Raven.config('your dsn', {" +
      '\n' +
      '  ' +
      "release: '0e4fdef81448dcfa0e16ecc4433ff3997aa53572'" +
      '\n' +
      '});'
    );
  }

  renderBody() {
    let {organization, project, plugins} = this.props;

    if (plugins.loading) {
      return <LoadingIndicator />;
    }

    let pluginList = plugins.plugins.filter(
      p => p.type === 'release-tracking' && p.hasConfiguration
    );

    let {token, webhookUrl} = this.state.data;

    token = getDynamicText({value: token, fixed: '__TOKEN__'});
    webhookUrl = getDynamicText({value: webhookUrl, fixed: '__WEBHOOK_URL__'});

    return (
      <div>
        <SettingsPageHeader title={t('Release Tracking')} />
        <p>
          {t(
            'Configure release tracking for this project to automatically record new releases of your application.'
          )}
        </p>

        <Panel>
          <PanelHeader>{t('Client Configuration')}</PanelHeader>
          <PanelBody disablePadding={false} flex>
            <p>
              {tct('Start by binding the [release] attribute in your application', {
                release: <code>release</code>,
              })}
            </p>
            <AutoSelectText>
              <pre>{this.getReleaseClientConfigurationIntructions()}</pre>
            </AutoSelectText>
            <p>
              {t(
                "This will annotate each event with the version of your application, as well as automatically create a release entity in the system the first time it's seen."
              )}
            </p>
            <p>
              {t(
                'In addition you may configure a release hook (or use our API) to push a release and include additional metadata with it.'
              )}
            </p>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>{t('Deploy Token')}</PanelHeader>
          <PanelBody flex>
            <Field
              label={t('Token')}
              help={t('A unique secret which is used to generate deploy hook URLs')}
            >
              <TextCopyInput>{token}</TextCopyInput>
            </Field>
            <Field
              label={t('Regenerate Token')}
              help={t(
                'If a service becomes compromised, you should regenerate the token and re-configure any deploy hooks with the newly generated URL.'
              )}
            >
              <div>
                <Confirm
                  priority="danger"
                  onConfirm={this.handleRegenerateToken}
                  message={t(
                    'Are you sure you want to regenerate your token? Your current token will no longer be usable.'
                  )}
                >
                  <Button type="button" priority="danger">
                    {t('Regenerate Token')}
                  </Button>
                </Confirm>
              </div>
            </Field>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>{t('Webhook')}</PanelHeader>
          <PanelBody disablePadding={false} flex>
            <p>
              {t(
                'If you simply want to integrate with an existing system, sometimes its easiest just to use a webhook.'
              )}
            </p>

            <AutoSelectText>
              <pre>{webhookUrl}</pre>
            </AutoSelectText>

            <p>
              {t(
                'The release webhook accepts the same parameters as the "Create a new Release" API endpoint.'
              )}
            </p>

            <DynamicWrapper
              value={
                <AutoSelectText>
                  <pre>{this.getReleaseWebhookIntructions()}</pre>
                </AutoSelectText>
              }
              fixed={
                <pre>
                  {`curl __WEBHOOK_URL__ \\
  -X POST \\
  -H 'Content-Type: application/json' \\
  -d \'{"version": "abcdefg"}\'`}
                </pre>
              }
            />
          </PanelBody>
        </Panel>

        <PluginList
          organization={organization}
          project={project}
          pluginList={pluginList}
        />

        <Panel>
          <PanelHeader>{t('API')}</PanelHeader>
          <PanelBody disablePadding={false} flex>
            <p>
              {t(
                'You can notify Sentry when you release new versions of your application via our HTTP API.'
              )}
            </p>

            <p>
              {tct('See the [link:Releases API documentation] for more information.', {
                link: <a href="https://docs.sentry.io/hosted/api/releases/" />,
              })}
            </p>
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

export default withPlugins(ProjectReleaseTracking);

// Export for tests
export {ProjectReleaseTracking};
