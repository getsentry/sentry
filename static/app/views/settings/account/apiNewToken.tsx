import {useState} from 'react';

import ApiForm from 'sentry/components/forms/apiForm';
import TextareaField from 'sentry/components/forms/fields/textareaField';
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

export default function ApiNewToken() {
  const [permissions, setPermissions] = useState<Permissions>({
    Event: 'no-access',
    Team: 'no-access',
    Member: 'no-access',
    Project: 'no-access',
    Release: 'no-access',
    Organization: 'no-access',
    Alerts: 'no-access',
  });
  const [newToken, setNewToken] = useState<NewInternalAppApiToken | null>(null);
  const [preview, setPreview] = useState<string>('');

  const getPreview = () => {
    let previewString = '';
    for (const k in permissions) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      if (permissions[k] !== 'no-access') {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        previewString += `${k.toLowerCase()}:${permissions[k]}\n`;
      }
    }
    return previewString;
  };

  const onCancel = () => {
    browserHistory.push(normalizeUrl(API_INDEX_ROUTE));
  };

  const handleGoBack = () => {
    browserHistory.push(normalizeUrl(API_INDEX_ROUTE));
  };

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
            handleGoBack={handleGoBack}
          />
        ) : (
          <div>
            <ApiForm
              apiMethod="POST"
              apiEndpoint="/api-tokens/"
              initialData={{scopes: [], name: ''}}
              onSubmitSuccess={setNewToken}
              onCancel={onCancel}
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
                  />
                </PanelBody>
              </Panel>
              <Panel>
                <PanelHeader>{t('Permissions')}</PanelHeader>
                <PanelBody>
                  <PermissionSelection
                    appPublished={false}
                    permissions={permissions}
                    onChange={p => {
                      setPermissions(p);
                      setPreview(getPreview());
                    }}
                  />
                </PanelBody>
                <TextareaField
                  name="permissions-preview"
                  label={t('Permissions Preview')}
                  help={t('Your token will have the following scopes.')}
                  rows={3}
                  autosize
                  placeholder={preview}
                  disabled
                />
              </Panel>
            </ApiForm>
          </div>
        )}
      </div>
    </SentryDocumentTitle>
  );
}
