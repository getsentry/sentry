import {Component} from 'react';
import {browserHistory} from 'react-router';

import ApiForm from 'sentry/components/forms/apiForm';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {Permissions} from 'sentry/types';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionSelection from 'sentry/views/settings/organizationDeveloperSettings/permissionSelection';

const API_INDEX_ROUTE = '/settings/account/api/auth-tokens/';
type State = {
  permissions: Permissions;
};

export default class ApiNewToken extends Component<{}, State> {
  constructor(props: {}) {
    super(props);
    this.state = {
      permissions: {
        Event: 'no-access',
        Team: 'no-access',
        Member: 'no-access',
        Project: 'no-access',
        Release: 'no-access',
        Organization: 'no-access',
      },
    };
  }

  onCancel = () => {
    browserHistory.push(normalizeUrl(API_INDEX_ROUTE));
  };

  onSubmitSuccess = () => {
    browserHistory.push(normalizeUrl(API_INDEX_ROUTE));
  };

  render() {
    const {permissions} = this.state;
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
          <Panel>
            <PanelHeader>{t('Permissions')}</PanelHeader>
            <ApiForm
              apiMethod="POST"
              apiEndpoint="/api-tokens/"
              initialData={{scopes: []}}
              onSubmitSuccess={this.onSubmitSuccess}
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
              <PanelBody>
                <PermissionSelection
                  appPublished={false}
                  permissions={permissions}
                  onChange={value => {
                    this.setState({permissions: value});
                  }}
                />
              </PanelBody>
            </ApiForm>
          </Panel>
        </div>
      </SentryDocumentTitle>
    );
  }
}
