import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/actions/button';
import {Alert} from 'sentry/components/alert';
import Form from 'sentry/components/forms/form';
import FormField from 'sentry/components/forms/formField';
import JsonForm from 'sentry/components/forms/jsonForm';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import TextCopyInput from 'sentry/components/textCopyInput';
import apiApplication from 'sentry/data/forms/apiApplication';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {ApiApplication} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

type Props = RouteComponentProps<{appId: string}, {}>;
type State = {
  app: ApiApplication;
} & DeprecatedAsyncView['state'];

class ApiApplicationsDetails extends DeprecatedAsyncView<Props, State> {
  rotateClientSecret = async () => {
    try {
      const rotateResponse = await this.api.requestPromise(
        `/api-applications/${this.props.params.appId}/rotate-secret/`,
        {
          method: 'POST',
        }
      );
      openModal(({Body, Header}) => (
        <Fragment>
          <Header>{t('Rotated Client Secret')}</Header>
          <Body>
            <Alert type="info" showIcon>
              {t('This will be the only time your client secret is visible!')}
            </Alert>
            <p>
              {t('Your client secret is:')}
              <code>{rotateResponse.clientSecret}</code>
            </p>
          </Body>
        </Fragment>
      ));
    } catch {
      addErrorMessage(t('Error rotating secret'));
    }
  };

  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
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
                    <ClientSecret>
                      <HiddenSecret>{t('hidden')}</HiddenSecret>
                      <Button onClick={this.rotateClientSecret} priority="danger">
                        Rotate client secret
                      </Button>
                    </ClientSecret>
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

const HiddenSecret = styled('span')`
  width: 100px;
  font-style: italic;
`;

const ClientSecret = styled('div')`
  display: flex;
  justify-content: right;
  align-items: center;
  margin-right: 0;
`;

export default ApiApplicationsDetails;
