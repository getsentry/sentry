import PropTypes from 'prop-types';
import React from 'react';
import {browserHistory} from 'react-router';

import {addSuccessMessage} from 'app/actionCreators/indicator';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import FormModel from 'app/views/settings/components/forms/model';
import FormField from 'app/views/settings/components/forms/formField';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import PermissionsObserver from 'app/views/settings/organizationDeveloperSettings/permissionsObserver';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import sentryApplicationForm from 'app/data/forms/sentryApplication';
import getDynamicText from 'app/utils/getDynamicText';

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
    const {appSlug} = this.props.params;

    if (appSlug) {
      return [['app', `/sentry-apps/${appSlug}/`]];
    }

    return [];
  }

  getTitle() {
    return t('Sentry Integration Details');
  }

  // Events may come from the API as "issue.created" when we just want "issue" here.
  normalize(events) {
    if (events.length === 0) {
      return events;
    }

    return events.map(e => e.split('.').shift());
  }

  onSubmitSuccess = data => {
    const {orgId} = this.props.params;
    addSuccessMessage(t(`${data.name} successfully saved.`));
    browserHistory.push(`/settings/${orgId}/developer-settings/`);
  };

  onFieldChange = (name, value) => {
    if (name === 'isInternal') {
      if (value === true) {
        //cannot have verifyInstall=true for internal apps
        this.form.setValue('verifyInstall', false);
      }
      //trigger an update so we can change if verifyInstall is disabled or not
      this.forceUpdate();
    }
  };

  renderBody() {
    const {orgId} = this.props.params;
    const {app} = this.state;
    const scopes = (app && [...app.scopes]) || [];
    const events = (app && this.normalize(app.events)) || [];
    const statusDisabled = app && app.status === 'internal' ? true : false;
    // if the app is created and it is internal, don't need to check the form value
    const changeVerifyDisabled =
      statusDisabled || this.form.getValue('isInternal') ? true : false;
    const method = app ? 'PUT' : 'POST';
    const endpoint = app ? `/sentry-apps/${app.slug}/` : '/sentry-apps/';

    return (
      <div>
        <SettingsPageHeader title={this.getTitle()} />
        <Form
          apiMethod={method}
          apiEndpoint={endpoint}
          allowUndo
          initialData={{
            organization: orgId,
            isAlertable: false,
            isInternal: app && app.status === 'internal' ? true : false,
            schema: {},
            scopes: [],
            ...app,
          }}
          model={this.form}
          onSubmitSuccess={this.onSubmitSuccess}
          onFieldChange={this.onFieldChange}
        >
          <JsonForm
            additionalFieldProps={{statusDisabled, changeVerifyDisabled}}
            location={this.props.location}
            forms={sentryApplicationForm}
          />

          <PermissionsObserver scopes={scopes} events={events} />

          {app && (
            <Panel>
              <PanelHeader>{t('Credentials')}</PanelHeader>
              {app.status === 'internal' ? (
                <PanelBody>
                  <FormField name="token" label="Token" overflow>
                    {({value}) => {
                      return (
                        <TextCopyInput>
                          {getDynamicText({value, fixed: 'PERCY_ACCESS_TOKEN'})}
                        </TextCopyInput>
                      );
                    }}
                  </FormField>
                  <FormField overflow name="installation" label="Installation ID">
                    {({value}) => {
                      return (
                        <TextCopyInput>
                          {getDynamicText({
                            value: value.uuid,
                            fixed: 'PERCY_INSTALLATION_ID',
                          })}
                        </TextCopyInput>
                      );
                    }}
                  </FormField>
                </PanelBody>
              ) : (
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
              )}
            </Panel>
          )}
        </Form>
      </div>
    );
  }
}
