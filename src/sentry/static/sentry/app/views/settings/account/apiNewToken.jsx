import {browserHistory} from 'react-router';
import DocumentTitle from 'react-document-title';
import React from 'react';

import {API_ACCESS_SCOPES, DEFAULT_API_ACCESS_SCOPES} from 'app/constants';
import {t, tct} from 'app/locale';
import ApiForm from 'app/views/settings/components/forms/apiForm';
import FormField from 'app/views/settings/components/forms/formField';
import MultipleCheckbox from 'app/views/settings/components/forms/controls/multipleCheckbox';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

const SORTED_DEFAULT_API_ACCESS_SCOPES = DEFAULT_API_ACCESS_SCOPES.sort();
const API_CHOICES = API_ACCESS_SCOPES.map(s => [s, s]);
const API_INDEX_ROUTE = '/settings/account/api/auth-tokens/';

export default class ApiNewToken extends React.Component {
  onCancel = () => {
    browserHistory.push(API_INDEX_ROUTE);
  };

  onSubmitSuccess = () => {
    browserHistory.push(API_INDEX_ROUTE);
  };

  render() {
    return (
      <DocumentTitle title="Create API Token - Sentry">
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
                link: <a href="https://docs.sentry.io/api/" />,
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
                <FormField
                  name="scopes"
                  choices={API_CHOICES}
                  label={t('Scopes')}
                  inline={false}
                  required
                >
                  {({value, onChange}) => (
                    <MultipleCheckbox
                      onChange={onChange}
                      value={value}
                      choices={API_CHOICES}
                    />
                  )}
                </FormField>
              </PanelBody>
            </ApiForm>
          </Panel>
        </div>
      </DocumentTitle>
    );
  }
}
