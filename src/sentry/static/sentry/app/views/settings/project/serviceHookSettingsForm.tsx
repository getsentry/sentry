import React from 'react';
import {browserHistory} from 'react-router';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import {Choices, ServiceHook} from 'app/types';
import ApiForm from 'app/views/settings/components/forms/apiForm';
import BooleanField from 'app/views/settings/components/forms/booleanField';
import MultipleCheckbox from 'app/views/settings/components/forms/controls/multipleCheckbox';
import FormField from 'app/views/settings/components/forms/formField';
import TextField from 'app/views/settings/components/forms/textField';

const EVENT_CHOICES: Choices = ['event.alert', 'event.created'].map(e => [e, e]);

type Props = {
  orgId: string;
  projectId: string;
  initialData: Partial<ServiceHook> & {isActive: boolean};
  hookId?: string;
};

export default class ServiceHookSettingsForm extends React.Component<Props> {
  onSubmitSuccess = () => {
    const {orgId, projectId} = this.props;
    browserHistory.push(`/settings/${orgId}/projects/${projectId}/hooks/`);
  };

  render() {
    const {initialData, orgId, projectId, hookId} = this.props;

    const endpoint = hookId
      ? `/projects/${orgId}/${projectId}/hooks/${hookId}/`
      : `/projects/${orgId}/${projectId}/hooks/`;

    return (
      <Panel>
        <ApiForm
          apiMethod={hookId ? 'PUT' : 'POST'}
          apiEndpoint={endpoint}
          initialData={initialData}
          onSubmitSuccess={this.onSubmitSuccess}
          footerStyle={{
            marginTop: 0,
            paddingRight: 20,
          }}
          submitLabel={hookId ? t('Save Changes') : t('Create Hook')}
        >
          <PanelHeader>{t('Hook Configuration')}</PanelHeader>
          <PanelBody>
            <BooleanField name="isActive" label={t('Active')} />
            <TextField
              name="url"
              label={t('URL')}
              required
              help={t('The URL which will receive events.')}
            />
            <FormField
              name="events"
              label={t('Events')}
              inline={false}
              help={t('The event types you wish to subscribe to.')}
            >
              {({value, onChange}) => (
                <MultipleCheckbox
                  onChange={onChange}
                  value={value}
                  choices={EVENT_CHOICES}
                />
              )}
            </FormField>
          </PanelBody>
        </ApiForm>
      </Panel>
    );
  }
}
