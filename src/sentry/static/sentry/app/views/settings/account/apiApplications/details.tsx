import {RouteComponentProps} from 'react-router/lib/Router';

import {ApiApplication} from 'app/types';
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
import apiApplication from 'app/data/forms/apiApplication';
import getDynamicText from 'app/utils/getDynamicText';

type Props = RouteComponentProps<{appId: string}, {}>;
type State = {
  app: ApiApplication;
} & AsyncView['state'];

class ApiApplicationsDetails extends AsyncView<Props, State> {
  getEndpoints(): [string, string][] {
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
          <JsonForm location={this.props.location} forms={apiApplication} />

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
