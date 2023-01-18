import {Component} from 'react';
import {browserHistory} from 'react-router';

import ApiForm from 'sentry/components/forms/apiForm';
import MultipleCheckbox from 'sentry/components/forms/controls/multipleCheckbox';
import FormField from 'sentry/components/forms/formField';
import ExternalLink from 'sentry/components/links/externalLink';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {API_ACCESS_SCOPES, DEFAULT_API_ACCESS_SCOPES} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

const SORTED_DEFAULT_API_ACCESS_SCOPES = DEFAULT_API_ACCESS_SCOPES.sort();
const API_INDEX_ROUTE = '/settings/account/api/auth-tokens/';

export default class ApiNewToken extends Component {
  onCancel = () => {
    browserHistory.push(normalizeUrl(API_INDEX_ROUTE));
  };

  onSubmitSuccess = () => {
    browserHistory.push(normalizeUrl(API_INDEX_ROUTE));
  };

  render() {
    return (
      <SentryDocumentTitle title={t('Create API Token')}>
        <div>
          <SettingsPageHeader title={t('Create New Token')} />
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
            <PanelHeader>{t('Create New Token')}</PanelHeader>
            <ApiForm
              apiMethod="POST"
              apiEndpoint="/api-tokens/"
              initialData={{scopes: SORTED_DEFAULT_API_ACCESS_SCOPES}}
              onSubmitSuccess={this.onSubmitSuccess}
              onCancel={this.onCancel}
              footerStyle={{
                marginTop: 0,
                paddingRight: 20,
              }}
              submitLabel={t('Create Token')}
            >
              <PanelBody>
                <FormField name="scopes" label={t('Scopes')} inline={false} required>
                  {({name, value, onChange}) => (
                    <MultipleCheckbox onChange={onChange} value={value} name={name}>
                      {API_ACCESS_SCOPES.map(scope => (
                        <MultipleCheckbox.Item value={scope} key={scope}>
                          {scope}
                        </MultipleCheckbox.Item>
                      ))}
                    </MultipleCheckbox>
                  )}
                </FormField>
              </PanelBody>
            </ApiForm>
          </Panel>
        </div>
      </SentryDocumentTitle>
    );
  }
}
