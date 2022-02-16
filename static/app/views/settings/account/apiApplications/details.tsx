import {RouteComponentProps} from 'react-router';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import Form from 'sentry/components/forms/form';
import FormField from 'sentry/components/forms/formField';
import JsonForm from 'sentry/components/forms/jsonForm';
import TextCopyInput from 'sentry/components/forms/textCopyInput';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import apiApplication from 'sentry/data/forms/apiApplication';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {ApiApplication} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

type Props = RouteComponentProps<{appId: string}, {}>;
type State = {
  app: ApiApplication;
} & AsyncView['state'];

class ApiApplicationsDetails extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [['app', `/api-applications/${this.props.params.appId}/`]];
  }

  getTitle() {
    return t('Application Details');
  }

  renderBody() {
    const urlPrefix = ConfigStore.get('urlPrefix');

    return (
      <div>
        <SettingsPageHeader title={this.getTitle()} />

        <Form
          apiMethod="PUT"
          apiEndpoint={`/api-applications/${this.props.params.appId}/`}
          saveOnBlur
          allowUndo
          initialData={this.state.app}
          onSubmitError={() => addErrorMessage('Unable to save change')}
        >
          <JsonForm forms={apiApplication} />

          <Panel>
            <PanelHeader>{t('Credentials')}</PanelHeader>

            <PanelBody>
              <FormField name="clientID" label="Client ID">
                {({value}) => (
                  <div>
                    <TextCopyInput>
                      {getDynamicText({value, fixed: 'CI_CLIENT_ID'})}
                    </TextCopyInput>
                  </div>
                )}
              </FormField>

              <FormField
                name="clientSecret"
                label="Client Secret"
                help={t(`Your secret is only available briefly after application creation. Make
                  sure to save this value!`)}
              >
                {({value}) =>
                  value ? (
                    <TextCopyInput>
                      {getDynamicText({value, fixed: 'CI_CLIENT_SECRET'})}
                    </TextCopyInput>
                  ) : (
                    <em>hidden</em>
                  )
                }
              </FormField>

              <FormField name="" label="Authorization URL">
                {() => <TextCopyInput>{`${urlPrefix}/oauth/authorize/`}</TextCopyInput>}
              </FormField>

              <FormField name="" label="Token URL">
                {() => <TextCopyInput>{`${urlPrefix}/oauth/token/`}</TextCopyInput>}
              </FormField>
            </PanelBody>
          </Panel>
        </Form>
      </div>
    );
  }
}

export default ApiApplicationsDetails;
