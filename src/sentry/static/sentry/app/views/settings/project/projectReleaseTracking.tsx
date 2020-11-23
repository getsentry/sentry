import React from 'react';
import {WithRouterProps} from 'react-router';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import Alert from 'app/components/alert';
import AutoSelectText from 'app/components/autoSelectText';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import PluginList from 'app/components/pluginList';
import {IconFlag} from 'app/icons';
import {t, tct} from 'app/locale';
import {Organization, Plugin, Project} from 'app/types';
import getDynamicText from 'app/utils/getDynamicText';
import routeTitleGen from 'app/utils/routeTitle';
import withPlugins from 'app/utils/withPlugins';
import AsyncView from 'app/views/asyncView';
import Field from 'app/views/settings/components/forms/field';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

const TOKEN_PLACEHOLDER = 'YOUR_TOKEN';
const WEBHOOK_PLACEHOLDER = 'YOUR_WEBHOOK_URL';

type Props = {
  organization: Organization;
  project: Project;
  plugins: {plugins: Plugin[]; loading: boolean};
} & WithRouterProps<{orgId: string; projectId: string}, {}>;

type State = {
  data: {
    token: string;
    webhookUrl: string;
  } | null;
} & AsyncView['state'];

const placeholderData = {
  token: TOKEN_PLACEHOLDER,
  webhookUrl: WEBHOOK_PLACEHOLDER,
};

class ProjectReleaseTracking extends AsyncView<Props, State> {
  getTitle() {
    const {projectId} = this.props.params;
    return routeTitleGen(t('Releases'), projectId, false);
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {orgId, projectId} = this.props.params;

    // Allow 403s
    return [
      [
        'data',
        `/projects/${orgId}/${projectId}/releases/token/`,
        {},
        {allowError: err => err && err.status === 403},
      ],
    ];
  }

  handleRegenerateToken = () => {
    const {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/releases/token/`, {
      method: 'POST',
      data: {project: projectId},
      success: data => {
        this.setState({
          data: {
            token: data.token,
            webhookUrl: data.webhookUrl,
          },
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
    const {webhookUrl} = this.state.data || placeholderData;
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

  renderBody() {
    const {organization, project, plugins} = this.props;
    const hasWrite = organization.access.includes('project:write');

    if (plugins.loading) {
      return <LoadingIndicator />;
    }

    const pluginList = plugins.plugins.filter(
      (p: Plugin) => p.type === 'release-tracking' && p.hasConfiguration
    );

    let {token, webhookUrl} = this.state.data || placeholderData;

    token = getDynamicText({value: token, fixed: '__TOKEN__'});
    webhookUrl = getDynamicText({value: webhookUrl, fixed: '__WEBHOOK_URL__'});

    return (
      <div>
        <SettingsPageHeader title={t('Release Tracking')} />
        {!hasWrite && (
          <Alert icon={<IconFlag size="md" />} type="warning">
            {t(
              'You do not have sufficient permissions to access Release tokens, placeholders are displayed below.'
            )}
          </Alert>
        )}
        <p>
          {t(
            'Configure release tracking for this project to automatically record new releases of your application.'
          )}
        </p>

        <Panel>
          <PanelHeader>{t('Client Configuration')}</PanelHeader>
          <PanelBody flexible withPadding>
            <p>
              {tct(
                'Start by binding the [release] attribute in your application, take a look at [link] to see how to configure this for the SDK you are using.',
                {
                  link: (
                    <a href="https://docs.sentry.io/workflow/releases/#configure-sdk">
                      our docs
                    </a>
                  ),
                  release: <code>release</code>,
                }
              )}
            </p>
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
          <PanelBody flexible>
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
                  disabled={!hasWrite}
                  priority="danger"
                  onConfirm={this.handleRegenerateToken}
                  message={t(
                    'Are you sure you want to regenerate your token? Your current token will no longer be usable.'
                  )}
                >
                  <Button type="button" priority="danger" disabled={!hasWrite}>
                    {t('Regenerate Token')}
                  </Button>
                </Confirm>
              </div>
            </Field>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>{t('Webhook')}</PanelHeader>
          <PanelBody flexible withPadding>
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

            {getDynamicText({
              value: (
                <AutoSelectText>
                  <pre>{this.getReleaseWebhookIntructions()}</pre>
                </AutoSelectText>
              ),
              fixed: (
                <pre>
                  {`curl __WEBHOOK_URL__ \\
  -X POST \\
  -H 'Content-Type: application/json' \\
  -d \'{"version": "abcdefg"}\'`}
                </pre>
              ),
            })}
          </PanelBody>
        </Panel>

        <PluginList
          organization={organization}
          project={project}
          pluginList={pluginList}
        />

        <Panel>
          <PanelHeader>{t('API')}</PanelHeader>
          <PanelBody flexible withPadding>
            <p>
              {t(
                'You can notify Sentry when you release new versions of your application via our HTTP API.'
              )}
            </p>

            <p>
              {tct('See the [link:releases documentation] for more information.', {
                link: <a href="https://docs.sentry.io/workflow/releases/" />,
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
