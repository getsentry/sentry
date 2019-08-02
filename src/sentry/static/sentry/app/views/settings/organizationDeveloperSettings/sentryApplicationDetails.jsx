import PropTypes from 'prop-types';
import React from 'react';
import {browserHistory} from 'react-router';

import {addSuccessMessage} from 'app/actionCreators/indicator';
import {Panel, PanelItem, PanelBody, PanelHeader} from 'app/components/panels';
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

import DateTime from 'app/components/dateTime';
import Button from 'app/components/button';

import styled from 'react-emotion';
import {
  addSentryAppToken,
  removeSentryAppToken,
} from 'app/actionCreators/sentryAppTokens';
import space from 'app/styles/space';

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
      tokens: [],
    };
  }

  getEndpoints() {
    const {appSlug} = this.props.params;
    if (appSlug) {
      return [
        ['app', `/sentry-apps/${appSlug}/`],
        ['tokens', `/sentry-apps/${appSlug}/api-tokens/`],
      ];
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

  onAddToken = evt => {
    evt.preventDefault();
    const {app, tokens} = this.state;
    const api = this.api;

    addSentryAppToken(api, app).then(
      data => {
        tokens.push(data);
        this.setState({tokens});
      },
      () => {}
    );
  };

  onRemoveToken = (token, evt) => {
    evt.preventDefault();
    const {app, tokens} = this.state;
    const api = this.api;
    const newTokens = tokens.filter(t => {
      return t.token != token.token;
    });

    removeSentryAppToken(api, app, token.token).then(
      data => {
        this.setState({tokens: newTokens});
      },
      () => {}
    );
  };

  renderTokens = () => {
    const {tokens} = this.state;
    return (tokens || []).map(token => {
      return (
        <StyledPanelItem>
          <TokenItem>
            <TextCopyInput>{token.token}</TextCopyInput>
          </TokenItem>
          <CreatedDate>
            <CreatedTitle>Created:</CreatedTitle>
            <DateTime
              date={getDynamicText({
                value: token.dateCreated,
                fixed: new Date(1508208080000),
              })}
            />
          </CreatedDate>
          <Button
            onClick={this.onRemoveToken.bind(this, token)}
            size="small"
            icon="icon-trash"
          >
            Revoke
          </Button>
        </StyledPanelItem>
      );
    });
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
            verifyInstall: (app && app.verifyInstall) || false,
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
              <PanelHeader hasButton={true}>
                {t('Tokens')}
                <Button
                  size="xsmall"
                  icon="icon-circle-add"
                  onClick={evt => this.onAddToken(evt)}
                >
                  New Token
                </Button>
              </PanelHeader>
              {app.status === 'internal' ? (
                <PanelBody>{this.renderTokens()}</PanelBody>
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

const StyledPanelItem = styled(PanelItem)`
  display: flex;
  justify-content: space-between;
`;

const TokenItem = styled('div')`
  width: 70%;
`;

const CreatedTitle = styled('span')`
  color: ${p => p.theme.gray2};
  margin-bottom: 2px;
`;
const CreatedDate = styled('div')`
  display: flex;
  flex-direction: column;
  font-size: 14px;
  margin: 0 10px;
`;
