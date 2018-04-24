import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {addErrorMessage, addSuccessMessage} from '../../../actionCreators/indicator';
import {t, tct} from '../../../locale';
import AsyncView from '../../asyncView';
import AutoSelectText from '../../../components/autoSelectText';
import Button from '../../../components/buttons/button';
import Confirm from '../../../components/confirm';
import DynamicWrapper from '../../../components/dynamicWrapper';
import Field from '../components/forms/field';
import LoadingIndicator from '../../../components/loadingIndicator';
import {Panel, PanelBody, PanelHeader} from '../../../components/panels';
import PluginList from '../../../components/pluginList';
import SentryTypes from '../../../proptypes';
import SettingsPageHeader from '../components/settingsPageHeader';
import TextBlock from '../components/text/textBlock';
import TextCopyInput from '../components/forms/textCopyInput';
import withPlugins from '../../../utils/withPlugins';

const noMargin = {margin: 0};
const marginTop = {marginTop: 30};

const PreWrap = styled.pre`
  word-break: break-all !important;
  white-space: pre-wrap !important;
`;

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

    return (
      <div>
        <SettingsPageHeader title={t('Release Tracking')} />
        <TextBlock>
          {t(
            'Configure release tracking for this project to automatically record new releases of your application.'
          )}
        </TextBlock>

        <Panel>
          <PanelHeader>{t('Client Configuration')}</PanelHeader>
          <PanelBody disablePadding={false} flex>
            <TextBlock css={noMargin}>
              {tct('Start by binding the [release] attribute in your application', {
                release: <code>release</code>,
              })}
            </TextBlock>
            <AutoSelectText>
              <PreWrap style={noMargin}>
                {this.getReleaseClientConfigurationIntructions()}
              </PreWrap>
            </AutoSelectText>
            <TextBlock css={marginTop}>
              {t(
                "This will annotate each event with the version of your application, as well as automatically create a release entity in the system the first time it's seen."
              )}
            </TextBlock>
            <TextBlock css={noMargin}>
              {t(
                'In addition you may configure a release hook (or use our API) to push a release and include additional metadata with it.'
              )}
            </TextBlock>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>{t('Deploy Token')}</PanelHeader>
          <PanelBody flex>
            <Field
              label={t('Token')}
              help={t('A unique secret which is used to generate deploy hook URLs')}
            >
              <DynamicWrapper
                value={<TextCopyInput>{token}</TextCopyInput>}
                fixed="__TOKEN__"
              />
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
            <TextBlock css={noMargin}>
              {t(
                'If you simply want to integrate with an existing system, sometimes its easiest just to use a webhook.'
              )}
            </TextBlock>

            <DynamicWrapper
              value={
                <AutoSelectText>
                  <PreWrap>{webhookUrl}</PreWrap>
                </AutoSelectText>
              }
              fixed={<PreWrap>__WEBHOOK_URL__</PreWrap>}
            />

            <TextBlock css={noMargin}>
              {t(
                'The release webhook accepts the same parameters as the "Create a new Release" API endpoint.'
              )}
            </TextBlock>

            <DynamicWrapper
              value={
                <AutoSelectText>
                  <PreWrap style={noMargin}>
                    {this.getReleaseWebhookIntructions()}
                  </PreWrap>
                </AutoSelectText>
              }
              fixed={
                <PreWrap style={noMargin}>
                  {`curl __WEBHOOK_URL__ \\
  -X POST \\
  -H 'Content-Type: application/json' \\
  -d \'{"version": "abcdefg"}\'`}
                </PreWrap>
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
            <TextBlock>
              {t(
                'You can notify Sentry when you release new versions of your application via our HTTP API.'
              )}
            </TextBlock>

            <TextBlock css={noMargin}>
              {tct('See the [link:Releases API documentation] for more information.', {
                link: <a href="https://docs.sentry.io/hosted/api/releases/" />,
              })}
            </TextBlock>
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

export default withPlugins(ProjectReleaseTracking);

// Export for tests
export {ProjectReleaseTracking};
