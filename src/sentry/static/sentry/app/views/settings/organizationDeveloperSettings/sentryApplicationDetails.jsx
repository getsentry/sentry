import {Flex, Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import ConfigStore from 'app/stores/configStore';
import Form from 'app/views/settings/components/forms/form';
import FormField from 'app/views/settings/components/forms/formField';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import sentryApplication from 'app/data/forms/sentryApplication';
import getDynamicText from 'app/utils/getDynamicText';
import Switch from 'app/components/switch';
import ApplicationScopes from './applicationScopes';

class SentryApplicationDetails extends AsyncView {
  static contextTypes = {
    router: PropTypes.object.isRequired,
  };

  getDefaultState() {
    return {
      loading: true,
      error: false,
      app: null,
      errors: {},
    };
  }

  getEndpoints() {
    return [['app', `/sentry-apps/`]];
  }

  getTitle() {
    return 'Sentry Application Details';
  }

  handleScopeChange = (onChange, onBlur, scope, scopes, e) => {
    onChange(scopes, e);
    onBlur(scopes, e);
  }

  onSubmitSuccess = (data) => {
    debugger;
  }

  renderBody() {
    let {orgId} = this.props.params;
    return (
      <div>
        <SettingsPageHeader title={this.getTitle()} />
        <Form
          apiMethod="POST"
          apiEndpoint={`/sentry-apps/`}
          allowUndo
          initialData={{organization: orgId}}
          onSubmitSuccess={this.onSubmitSuccess}
          onSubmitError={err => addErrorMessage('Unable to save change')}
        >
          <Box>
            <JsonForm location={this.props.location} forms={sentryApplication} />
            <Panel>
              <PanelHeader>{t('API Scopes')}</PanelHeader>
              <PanelBody>
                <FormField
                  name="scopes"
                  inline={false}
                  getData={data => ({scopes: data})}
                  required
                  >
                    {({onChange, onBlur}) => (
                      <ApplicationScopes
                        onToggle={this.handleScopeChange.bind(
                          this,
                          onChange,
                          onBlur
                        )}
                        data={['org:write', 'org:read']}
                      />
                    )}
                  </FormField>
              </PanelBody>
            </Panel>
            <Panel>
              <PanelHeader>{t('Credentials')}</PanelHeader>

              <PanelBody>
                <FormField name="clientID" label="Client ID" overflow>
                  {({value}) => {
                    return (
                      <div>
                        <TextCopyInput>
                          {getDynamicText({value, fixed: 'PERCY_CLIENT_ID'})}
                        </TextCopyInput>
                      </div>
                    );
                  }}
                </FormField>

                <FormField
                  overflow
                  name="clientSecret"
                  label="Client Secret"
                  help={t(`Your secret is only available briefly after application creation. Make
                  sure to save this value!`)}
                >
                  {({value}) => {
                    return value ? (
                      <TextCopyInput>
                        {getDynamicText({value, fixed: 'PERCY_CLIENT_SECRET'})}
                      </TextCopyInput>
                    ) : (
                      <em>hidden</em>
                    );
                  }}
                </FormField>
              </PanelBody>
            </Panel>
          </Box>
        </Form>
      </div>
    );
  }
}

export default SentryApplicationDetails;
