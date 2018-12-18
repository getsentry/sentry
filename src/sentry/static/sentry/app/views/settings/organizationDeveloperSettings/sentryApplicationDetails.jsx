import PropTypes from 'prop-types';
import React from 'react';
import {browserHistory} from 'react-router';

import {defined} from 'app/utils';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import FormField from 'app/views/settings/components/forms/formField';
import MultipleCheckbox from 'app/views/settings/components/forms/controls/multipleCheckbox';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import sentryApplicationForm from 'app/data/forms/sentryApplication';
import getDynamicText from 'app/utils/getDynamicText';
import ApplicationScopes from './applicationScopes';

const EVENT_CHOICES = [['issue', 'Issue events']];

class SentryApplicationDetails extends AsyncView {
  static contextTypes = {
    router: PropTypes.object.isRequired,
  };

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

  handleScopeChange = (onChange, onBlur, scope, scopes, e) => {
    onChange(scopes, e);
    onBlur(scopes, e);
  };

  onSubmitSuccess = data => {
    const {orgId} = this.props.params;
    browserHistory.push(`/settings/${orgId}/developer-settings/`);
  };

  renderBody() {
    const {orgId} = this.props.params;
    const {app} = this.state;
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
          onSubmitSuccess={this.onSubmitSuccess}
          onSubmitError={err => addErrorMessage(t('Unable to save change'))}
        >
          <JsonForm location={this.props.location} forms={sentryApplicationForm} />
          <Panel>
            <PanelHeader>{t('API Scopes')}</PanelHeader>
            <PanelBody>
              <FormField
                name="scopes"
                inline={false}
                flexibleControlStateSize={true}
                getData={data => ({scopes: data})}
                required
              >
                {({onChange, onBlur}) => (
                  <ApplicationScopes
                    onToggle={this.handleScopeChange.bind(this, onChange, onBlur)}
                    scopes={app && app.scopes ? app.scopes : []}
                  />
                )}
              </FormField>
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

export default SentryApplicationDetails;
