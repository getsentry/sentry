import {useCallback, useState} from 'react';

import {ExternalLink} from 'sentry/components/core/link';
import ApiForm from 'sentry/components/forms/apiForm';
import TextareaField from 'sentry/components/forms/fields/textareaField';
import TextField from 'sentry/components/forms/fields/textField';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {SENTRY_APP_PERMISSIONS} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import type {Permissions} from 'sentry/types/integrations';
import type {NewInternalAppApiToken} from 'sentry/types/user';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {displayNewToken} from 'sentry/views/settings/components/newTokenHandler';
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
    Distribution: 'no-access',
  });
  const navigate = useNavigate();
  const organization = useOrganization({allowNull: true});
  const [hasNewToken, setHasnewToken] = useState(false);
  const [preview, setPreview] = useState<string>('');

  const hasPreprodFeature =
    organization?.features.includes('organizations:preprod-build-distribution') ?? false;

  const displayedPermissions = SENTRY_APP_PERMISSIONS.filter(
    o => o.resource !== 'Distribution' || hasPreprodFeature
  );

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

  const handleGoBack = useCallback(
    () => navigate(normalizeUrl(API_INDEX_ROUTE)),
    [navigate]
  );

  return (
    <SentryDocumentTitle title={t('Create New Personal Token')}>
      <div>
        <SettingsPageHeader title={t('Create New Personal Token')} />
        <TextBlock>
          {t(
            "Personal tokens allow you to perform actions against the Sentry API on behalf of your account. They're the easiest way to get started using the API."
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
        <ApiForm
          apiMethod="POST"
          apiEndpoint="/api-tokens/"
          initialData={{scopes: [], name: ''}}
          onSubmitSuccess={(token: NewInternalAppApiToken) => {
            setHasnewToken(true);
            displayNewToken(token.token, handleGoBack);
          }}
          onCancel={handleGoBack}
          footerStyle={{
            marginTop: 0,
            paddingRight: 20,
          }}
          submitDisabled={
            !!hasNewToken ||
            Object.values(permissions).every(value => value === 'no-access')
          }
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
                displayedPermissions={displayedPermissions}
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
    </SentryDocumentTitle>
  );
}
