import {Component} from 'react';

import ApiForm from 'sentry/components/forms/apiForm';
import TextField from 'sentry/components/forms/fields/textField';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {Permissions} from 'sentry/types/integrations';
import type {NewInternalAppApiToken} from 'sentry/types/user';
import {browserHistory} from 'sentry/utils/browserHistory';
import getDynamicText from 'sentry/utils/getDynamicText';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import NewTokenHandler from 'sentry/views/settings/components/newTokenHandler';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionSelection from 'sentry/views/settings/organizationDeveloperSettings/permissionSelection';

const API_INDEX_ROUTE = '/settings/account/api/auth-tokens/';
type State = {
  name: string | null;
  newToken: NewInternalAppApiToken | null;
  permissions: Permissions;
};

export default class ApiNewToken extends Component<{}, State> {
  constructor(props: {}) {
    super(props);
    this.state = {
      name: null,
      permissions: {
        Event: 'no-access',
        Team: 'no-access',
        Member: 'no-access',
        Project: 'no-access',
        Release: 'no-access',
        Organization: 'no-access',
        Alerts: 'no-access',
      },
      newToken: null,
    };
  }

  onCancel = () => {
    browserHistory.push(normalizeUrl(API_INDEX_ROUTE));
  };

  handleGoBack = () => {
    browserHistory.push(normalizeUrl(API_INDEX_ROUTE));
  };

  render() {
    const {permissions, newToken} = this.state;

    return (
      <SentryDocumentTitle title={t('Create User Auth Token')}>
        <div>
          <SettingsPageHeader title={t('Create New User Auth Token')} />
          <TextBlock>
            {t(
              "Authentication tokens allow you to perform actions against the Sentry API on behalf of your account. They're the easiest way to get started using the API."
            )}
          </TextBlock>
          <TextBlock>
            {tct(
              'For more information on how to use the web API, see our [link:documentation].',
              {
                link: <ExternalLink href="https://docs.sentry.io/api/" />,
              }
            )}
          </TextBlock>
          {newToken !== null ? (
            <NewTokenHandler
              token={
                getDynamicText({value: newToken.token, fixed: 'CI_AUTH_TOKEN'}) ||
                'CI_AUTH_TOKEN'
              }
              handleGoBack={this.handleGoBack}
            />
          ) : (
            <div>
              <ApiForm
                apiMethod="POST"
                apiEndpoint="/api-tokens/"
                initialData={{scopes: [], name: ''}}
                onSubmitSuccess={response => {
                  this.setState({newToken: response});
                }}
                onCancel={this.onCancel}
                footerStyle={{
                  marginTop: 0,
                  paddingRight: 20,
                }}
                submitDisabled={Object.values(permissions).every(
                  value => value === 'no-access'
                )}
                submitLabel={t('Create Token')}
              >
                <Panel>
                  <PanelHeader>{t('General')}</PanelHeader>
                  <PanelBody>
                    <TextField
                      name="name"
                      label={t('Name')}
                      help={t('A name to help you identify this token.')}
                      onChange={value => {
                        this.setState({name: value});
                      }}
                    />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader>{t('Permissions')}</PanelHeader>
                  <PanelBody>
                    <PermissionSelection
                      appPublished={false}
                      permissions={permissions}
                      onChange={value => {
                        this.setState({permissions: value});
                      }}
                    />
                  </PanelBody>
                </Panel>
              </ApiForm>
            </div>
          )}
        </div>
      </SentryDocumentTitle>
    );
  }
}
