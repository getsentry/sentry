import PropTypes from 'prop-types';
import React from 'react';

import {Box} from '../../../components/grid';
import {addErrorMessage} from '../../../actionCreators/indicator';
import {t} from '../../../locale';
import AsyncView from '../../asyncView';
import ConfigStore from '../../../stores/configStore';
import Form from '../components/forms/form';
import FormField from '../components/forms/formField';
import JsonForm from '../components/forms/jsonForm';
import {Panel, PanelBody, PanelHeader} from '../../../components/panels';
import SettingsPageHeader from '../components/settingsPageHeader';
import TextCopyInput from '../components/forms/textCopyInput';
import apiApplication from '../../../data/forms/apiApplication';

class ApiApplicationDetails extends AsyncView {
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
    return [['app', `/api-applications/${this.props.params.appId}/`]];
  }

  getTitle() {
    return 'Application Details';
  }

  renderBody() {
    let urlPrefix = ConfigStore.get('urlPrefix');

    return (
      <div>
        <SettingsPageHeader title={this.getTitle()} />

        <Form
          apiMethod="PUT"
          apiEndpoint={`/api-applications/${this.props.params.appId}/`}
          saveOnBlur
          allowUndo
          initialData={this.state.app}
          onSubmitError={err => addErrorMessage('Unable to save change')}
        >
          <Box>
            <JsonForm location={this.props.location} forms={apiApplication} />

            <Panel>
              <PanelHeader>{t('Credentials')}</PanelHeader>

              <PanelBody>
                <FormField name="clientID" label="Client ID" overflow>
                  {({value}) => {
                    return (
                      <div>
                        <TextCopyInput>{value}</TextCopyInput>
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
                      <TextCopyInput>{value}</TextCopyInput>
                    ) : (
                      <em>hidden</em>
                    );
                  }}
                </FormField>

                <FormField name="" label="Authorization URL">
                  {({value}) => {
                    return (
                      <TextCopyInput>{`${urlPrefix}/oauth/authorize/`}</TextCopyInput>
                    );
                  }}
                </FormField>

                <FormField name="" label="Token URL">
                  {() => {
                    let value = `${urlPrefix}/oauth/token/`;
                    return <TextCopyInput>{value}</TextCopyInput>;
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

export default ApiApplicationDetails;
