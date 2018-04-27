import {browserHistory} from 'react-router';
import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';

import {t} from 'app/locale';
import ApiForm from 'app/views/settings/components/forms/apiForm';
import BooleanField from 'app/views/settings/components/forms/booleanField';
import FormField from 'app/views/settings/components/forms/formField';
import TextField from 'app/views/settings/components/forms/textField';
import MultipleCheckbox from 'app/views/settings/components/forms/controls/multipleCheckbox';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';

const EVENT_CHOICES = ['event.alert', 'event.created'].map(e => [e, e]);

export default createReactClass({
  displayName: 'ServiceHookSettingsForm',

  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    hookId: PropTypes.string,
    initialData: PropTypes.object.isRequired,
  },

  onSubmitSuccess() {
    let {orgId, projectId} = this.props;
    browserHistory.push(`/settings/${orgId}/${projectId}/hooks/`);
  },

  render() {
    let {initialData, orgId, projectId, hookId} = this.props;

    let endpoint = hookId
      ? `/projects/${orgId}/${projectId}/hooks/${hookId}/`
      : `/projects/${orgId}/${projectId}/hooks/`;

    return (
      <Panel>
        <ApiForm
          apiMethod={hookId ? 'PUT' : 'POST'}
          apiEndpoint={endpoint}
          initialData={initialData}
          onSubmitSuccess={this.onSubmitSuccess}
          onCancel={this.onCancel}
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
              choices={EVENT_CHOICES}
              label={t('Events')}
              inline={false}
              help={t('The event types you wish to subscribe to.')}
            >
              {({value, onChange}) => (
                <MultipleCheckbox
                  onChange={onChange}
                  value={value.peek()}
                  choices={EVENT_CHOICES}
                />
              )}
            </FormField>
          </PanelBody>
        </ApiForm>
      </Panel>
    );
  },
});
