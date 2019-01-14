import PropTypes from 'prop-types';
import React from 'react';
import {browserHistory} from 'react-router';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {defined} from 'app/utils';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import FormModel from 'app/views/settings/components/forms/model';
import FormField from 'app/views/settings/components/forms/formField';
import MultipleCheckbox from 'app/views/settings/components/forms/controls/multipleCheckbox';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import PermissionSelection from 'app/views/settings/organizationDeveloperSettings/permissionSelection';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import sentryApplicationForm from 'app/data/forms/sentryApplication';
import getDynamicText from 'app/utils/getDynamicText';

const EVENT_CHOICES = [['issue', 'Issue events']];

class SentryAppFormModel extends FormModel {
  /**
   * Filter out Permission input field values.
   *
   * Permissions (API Scopes) are presented as a list of SelectFields.
   * Instead of them being submitted individually, we want them rolled
   * up into a single list of scopes (this is done in `PermissionSelection`).
   *
   * Because they are all individual inputs, we end up with attributes
   * in the JSON we send to the API that we don't want.
   *
   * This function filters those attributes out of the data that is
   * ultimately sent to the API.
   */
  getData() {
    return Object.entries(this.fields.toJSON()).reduce((data, [k, v]) => {
      if (!k.endsWith('--permission')) {
        data[k] = v;
      }
      return data;
    }, {});
  }
}

export default class SentryApplicationDetails extends AsyncView {
  static contextTypes = {
    router: PropTypes.object.isRequired,
  };

  constructor(...args) {
    super(...args);
    this.form = new SentryAppFormModel();
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      app: null,
    };
  }

  getEndpoints() {
    let {appSlug} = this.props.params;

    if (appSlug) {
      return [['app', `/sentry-apps/${appSlug}/`]];
    }

    return [];
  }

  getTitle() {
    return t('Sentry Application Details');
  }

  // Events may come from the API as "issue.created" when we just want "issue" here.
  normalize(events) {
    if (events.length == 0) {
      return events;
    }

    return events.map(e => e.split('.').shift());
  }

  onSubmitSuccess = data => {
    const {orgId} = this.props.params;
    addSuccessMessage(t(`${this.state.app.name} successfully saved.`));
    browserHistory.push(`/settings/${orgId}/developer-settings/`);
  };

  renderBody() {
    const {orgId} = this.props.params;
    const {app} = this.state;
    const scopes = (app && [...app.scopes]) || [];

    let method = app ? 'PUT' : 'POST';
    let endpoint = app ? `/sentry-apps/${app.slug}/` : '/sentry-apps/';

    return (
      <div>
        <SettingsPageHeader title={this.getTitle()} />
        <Form
          apiMethod={method}
          apiEndpoint={endpoint}
          allowUndo
          initialData={{organization: orgId, isAlertable: false, ...app}}
          model={this.form}
          onSubmitSuccess={this.onSubmitSuccess}
          onSubmitError={err => addErrorMessage(t('Unable to save change'))}
        >
          <JsonForm location={this.props.location} forms={sentryApplicationForm} />

          <Panel>
            <PanelHeader>{t('Permissions')}</PanelHeader>
            <PanelBody>
              <PermissionSelection scopes={scopes} />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>{t('Event Subscriptions')}</PanelHeader>
            <PanelBody>
              <FormField
                name="events"
                inline={false}
                flexibleControlStateSize={true}
                choices={EVENT_CHOICES}
                getData={data => ({events: data})}
              >
                {({onChange, value}) => (
                  <MultipleCheckbox
                    choices={EVENT_CHOICES}
                    onChange={onChange}
                    value={this.normalize((defined(value.peek) && value.peek()) || [])}
                  />
                )}
              </FormField>
            </PanelBody>
          </Panel>

          {app && (
            <Panel>
              <PanelHeader>{t('Credentials')}</PanelHeader>
              <PanelBody>
                <FormField name="clientId" label="Client ID" overflow>
                  {({value}) => {
                    return (
                      <TextCopyInput>
                        {getDynamicText({value, fixed: 'PERCY_CLIENT_ID'})}
                      </TextCopyInput>
                    );
                  }}
                </FormField>
                <FormField overflow name="clientSecret" label="Client Secret">
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
          )}
        </Form>
      </div>
    );
  }
}
