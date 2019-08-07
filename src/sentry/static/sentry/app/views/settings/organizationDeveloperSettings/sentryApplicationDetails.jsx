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
import {
  publicIntegrationForms,
  internalIntegrationForms,
} from 'app/data/forms/sentryApplication';
import getDynamicText from 'app/utils/getDynamicText';

import DateTime from 'app/components/dateTime';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

import styled from 'react-emotion';
import {
  addSentryAppToken,
  removeSentryAppToken,
} from 'app/actionCreators/sentryAppTokens';

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

  get isInternal() {
    const {app} = this.state;
    if (app) {
      // if we are editing an existing app, check the status of the app
      return app.status === 'internal';
    }
    return this.props.route.path === 'new-internal/';
  }

  onAddToken = async evt => {
    evt.preventDefault();
    const {app, tokens} = this.state;
    const api = this.api;

    const token = await addSentryAppToken(api, app);
    const newTokens = tokens.concat(token);
    this.setState({tokens: newTokens});
  };

  onRemoveToken = async (token, evt) => {
    evt.preventDefault();
    const {app, tokens} = this.state;
    const api = this.api;
    const newTokens = tokens.filter(tok => tok.token !== token.token);

    await removeSentryAppToken(api, app, token.token);
    this.setState({tokens: newTokens});
  };

  renderTokens = () => {
    const {tokens} = this.state;
    if (tokens.length > 0) {
      return tokens.map(token => {
        return (
          <StyledPanelItem key={token.token}>
            <TokenItem>
              <TextCopyInput>
                {getDynamicText({value: token.token, fixed: 'xxxxxx'})}
              </TextCopyInput>
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
              data-test-id="token-delete"
            >
              {t('Revoke')}
            </Button>
          </StyledPanelItem>
        );
      });
    } else {
      return <EmptyMessage description={t('No tokens created yet.')} />;
    }
  };

  renderBody() {
    const {orgId} = this.props.params;
    const {app} = this.state;
    const scopes = (app && [...app.scopes]) || [];
    const events = (app && this.normalize(app.events)) || [];
    const method = app ? 'PUT' : 'POST';
    const endpoint = app ? `/sentry-apps/${app.slug}/` : '/sentry-apps/';

    const forms = this.isInternal ? internalIntegrationForms : publicIntegrationForms;
    let verifyInstall;
    if (this.isInternal) {
      //force verifyInstall to false for all internal apps
      verifyInstall = false;
    } else {
      verifyInstall = (app && app.verifyInstall) || false;
    }

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
            isInternal: this.isInternal,
            schema: {},
            scopes: [],
            ...app,
            verifyInstall, //need to overwrite the value in app for internal if it is true
          }}
          model={this.form}
          onSubmitSuccess={this.onSubmitSuccess}
        >
          <JsonForm location={this.props.location} forms={forms} />

          <PermissionsObserver scopes={scopes} events={events} />

          {app && (
            <React.Fragment>
              {app.status === 'internal' ? (
                <Panel>
                  <PanelHeader hasButtons>
                    {t('Tokens')}
                    <Button
                      size="xsmall"
                      icon="icon-circle-add"
                      onClick={evt => this.onAddToken(evt)}
                      data-test-id="token-add"
                    >
                      {t('New Token')}
                    </Button>
                  </PanelHeader>
                  <PanelBody>{this.renderTokens()}</PanelBody>
                </Panel>
              ) : (
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
            </React.Fragment>
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
