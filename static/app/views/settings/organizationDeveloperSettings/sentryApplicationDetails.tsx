import * as React from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import {Observer} from 'mobx-react';
import scrollToElement from 'scroll-to-element';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {
  addSentryAppToken,
  removeSentryAppToken,
} from 'sentry/actionCreators/sentryAppTokens';
import Avatar from 'sentry/components/avatar';
import AvatarChooser, {Model} from 'sentry/components/avatarChooser';
import Button from 'sentry/components/button';
import DateTime from 'sentry/components/dateTime';
import Form from 'sentry/components/forms/form';
import FormField from 'sentry/components/forms/formField';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel, {FieldValue} from 'sentry/components/forms/model';
import TextCopyInput from 'sentry/components/forms/textCopyInput';
import ExternalLink from 'sentry/components/links/externalLink';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'sentry/components/panels';
import Tooltip from 'sentry/components/tooltip';
import {SENTRY_APP_PERMISSIONS} from 'sentry/constants';
import {
  internalIntegrationForms,
  publicIntegrationForms,
} from 'sentry/data/forms/sentryApplication';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {InternalAppApiToken, Scope, SentryApp} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import AsyncView from 'sentry/views/asyncView';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import PermissionsObserver from 'sentry/views/settings/organizationDeveloperSettings/permissionsObserver';

type Resource = 'Project' | 'Team' | 'Release' | 'Event' | 'Organization' | 'Member';

const AVATAR_STYLES = {
  color: {
    size: 50,
    title: t('Default Logo'),
    previewText: t('The default icon for integrations'),
    help: t('Image must be between 256px by 256px and 1024px by 1024px.'),
  },
  simple: {
    size: 20,
    title: t('Default Icon'),
    previewText: tct('This is a silhouette icon used only for [uiDocs:UI Components]', {
      uiDocs: (
        <ExternalLink href="https://docs.sentry.io/product/integrations/integration-platform/ui-components/" />
      ),
    }),
    help: t(
      'Image must be between 256px by 256px and 1024px by 1024px, and may only use black and transparent pixels.'
    ),
  },
};

/**
 * Finds the resource in SENTRY_APP_PERMISSIONS that contains a given scope
 * We should always find a match unless there is a bug
 * @param {Scope} scope
 * @return {Resource | undefined}
 */
const getResourceFromScope = (scope: Scope): Resource | undefined => {
  for (const permObj of SENTRY_APP_PERMISSIONS) {
    const allChoices = Object.values(permObj.choices);

    const allScopes = allChoices.reduce(
      (_allScopes: string[], choice) => _allScopes.concat(choice?.scopes ?? []),
      []
    );

    if (allScopes.includes(scope)) {
      return permObj.resource as Resource;
    }
  }
  return undefined;
};

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
    return this.fields.toJSON().reduce((data, [k, v]) => {
      if (!k.endsWith('--permission')) {
        data[k] = v;
      }
      return data;
    }, {});
  }

  /**
   * We need to map the API response errors to the actual form fields.
   * We do this by pulling out scopes and mapping each scope error to the correct input.
   * @param {Object} responseJSON
   */
  mapFormErrors(responseJSON?: any) {
    if (!responseJSON) {
      return responseJSON;
    }
    const formErrors = omit(responseJSON, ['scopes']);
    if (responseJSON.scopes) {
      responseJSON.scopes.forEach((message: string) => {
        // find the scope from the error message of a specific format
        const matches = message.match(/Requested permission of (\w+:\w+)/);
        if (matches) {
          const scope = matches[1];
          const resource = getResourceFromScope(scope as Scope);
          // should always match but technically resource can be undefined
          if (resource) {
            formErrors[`${resource}--permission`] = [message];
          }
        }
      });
    }
    return formErrors;
  }
}

type Props = RouteComponentProps<{orgId: string; appSlug?: string}, {}>;

type State = AsyncView['state'] & {
  app: SentryApp | null;
  tokens: InternalAppApiToken[];
};

export default class SentryApplicationDetails extends AsyncView<Props, State> {
  form = new SentryAppFormModel();

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      app: null,
      tokens: [],
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {appSlug} = this.props.params;
    if (appSlug) {
      return [
        ['app', `/sentry-apps/${appSlug}/`],
        ['tokens', `/sentry-apps/${appSlug}/api-tokens/`],
      ];
    }

    return [];
  }

  getHeaderTitle() {
    const {app} = this.state;
    const action = app ? 'Edit' : 'Create';
    const type = this.isInternal ? 'Internal' : 'Public';
    return tct('[action] [type] Integration', {action, type});
  }

  // Events may come from the API as "issue.created" when we just want "issue" here.
  normalize(events) {
    if (events.length === 0) {
      return events;
    }

    return events.map(e => e.split('.').shift());
  }

  handleSubmitSuccess = (data: SentryApp) => {
    const {app} = this.state;
    const {orgId} = this.props.params;
    const baseUrl = `/settings/${orgId}/developer-settings/`;
    const url = app ? baseUrl : `${baseUrl}${data.slug}/`;
    if (app) {
      addSuccessMessage(t('%s successfully saved.', data.name));
    } else {
      addSuccessMessage(t('%s successfully created.', data.name));
    }
    browserHistory.push(url);
  };

  handleSubmitError = err => {
    let errorMessage = t('Unknown Error');
    if (err.status >= 400 && err.status < 500) {
      errorMessage = err?.responseJSON.detail ?? errorMessage;
    }
    addErrorMessage(errorMessage);

    if (this.form.formErrors) {
      const firstErrorFieldId = Object.keys(this.form.formErrors)[0];

      if (firstErrorFieldId) {
        scrollToElement(`#${firstErrorFieldId}`, {
          align: 'middle',
          offset: 0,
        });
      }
    }
  };

  get isInternal() {
    const {app} = this.state;
    if (app) {
      // if we are editing an existing app, check the status of the app
      return app.status === 'internal';
    }
    return this.props.route.path === 'new-internal/';
  }

  get showAuthInfo() {
    const {app} = this.state;
    return !(app && app.clientSecret && app.clientSecret[0] === '*');
  }

  onAddToken = async (evt: React.MouseEvent): Promise<void> => {
    evt.preventDefault();
    const {app, tokens} = this.state;
    if (!app) {
      return;
    }

    const api = this.api;

    const token = await addSentryAppToken(api, app);
    const newTokens = tokens.concat(token);
    this.setState({tokens: newTokens});
  };

  onRemoveToken = async (token: InternalAppApiToken, evt: React.MouseEvent) => {
    evt.preventDefault();
    const {app, tokens} = this.state;
    if (!app) {
      return;
    }

    const api = this.api;
    const newTokens = tokens.filter(tok => tok.token !== token.token);

    await removeSentryAppToken(api, app, token.token);
    this.setState({tokens: newTokens});
  };

  renderTokens = () => {
    const {tokens} = this.state;
    if (tokens.length > 0) {
      return tokens.map(token => (
        <StyledPanelItem key={token.token}>
          <TokenItem>
            <Tooltip
              disabled={this.showAuthInfo}
              position="right"
              containerDisplayMode="inline"
              title={t(
                'You do not have access to view these credentials because the permissions for this integration exceed those of your role.'
              )}
            >
              <TextCopyInput>
                {getDynamicText({value: token.token, fixed: 'xxxxxx'})}
              </TextCopyInput>
            </Tooltip>
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
            icon={<IconDelete />}
            data-test-id="token-delete"
            type="button"
          >
            {t('Revoke')}
          </Button>
        </StyledPanelItem>
      ));
    }
    return <EmptyMessage description={t('No tokens created yet.')} />;
  };

  onFieldChange = (name: string, value: FieldValue): void => {
    if (name === 'webhookUrl' && !value && this.isInternal) {
      // if no webhook, then set isAlertable to false
      this.form.setValue('isAlertable', false);
    }
  };

  addAvatar = ({avatar}: Model) => {
    const {app} = this.state;
    if (app && avatar) {
      const avatars =
        app?.avatars?.filter(prevAvatar => prevAvatar.color !== avatar.color) || [];
      avatars.push(avatar);
      this.setState({app: {...app, avatars}});
    }
  };

  getAvatarModel = (isColor: boolean): Model => {
    const {app} = this.state;
    const defaultModel: Model = {
      avatar: {
        avatarType: 'default',
        avatarUuid: null,
      },
    };
    if (!app) {
      return defaultModel;
    }
    return {
      avatar: app?.avatars?.find(({color}) => color === isColor) || defaultModel.avatar,
    };
  };

  getAvatarPreview = (isColor: boolean) => {
    const {app} = this.state;
    if (!app) {
      return null;
    }
    const avatarStyle = isColor ? 'color' : 'simple';
    return (
      <AvatarPreview>
        <StyledPreviewAvatar
          size={AVATAR_STYLES[avatarStyle].size}
          sentryApp={app}
          isDefault
        />
        <AvatarPreviewTitle>{AVATAR_STYLES[avatarStyle].title}</AvatarPreviewTitle>
        <AvatarPreviewText>{AVATAR_STYLES[avatarStyle].previewText}</AvatarPreviewText>
      </AvatarPreview>
    );
  };

  getAvatarChooser = (isColor: boolean) => {
    const {app} = this.state;
    if (!app) {
      return null;
    }
    const avatarStyle = isColor ? 'color' : 'simple';
    return (
      <AvatarChooser
        type={isColor ? 'sentryAppColor' : 'sentryAppSimple'}
        allowGravatar={false}
        allowLetter={false}
        endpoint={`/sentry-apps/${app.slug}/avatar/`}
        model={this.getAvatarModel(isColor)}
        onSave={this.addAvatar}
        title={isColor ? t('Logo') : t('Small Icon')}
        help={AVATAR_STYLES[avatarStyle].help.concat(
          this.isInternal ? '' : t(' Required for publishing.')
        )}
        savedDataUrl={undefined}
        defaultChoice={{
          allowDefault: true,
          choiceText: isColor ? t('Default logo') : t('Default small icon'),
          preview: this.getAvatarPreview(isColor),
        }}
      />
    );
  };

  renderBody() {
    const {orgId} = this.props.params;
    const {app} = this.state;
    const scopes = (app && [...app.scopes]) || [];
    const events = (app && this.normalize(app.events)) || [];
    const method = app ? 'PUT' : 'POST';
    const endpoint = app ? `/sentry-apps/${app.slug}/` : '/sentry-apps/';

    const forms = this.isInternal ? internalIntegrationForms : publicIntegrationForms;
    let verifyInstall: boolean;
    if (this.isInternal) {
      // force verifyInstall to false for all internal apps
      verifyInstall = false;
    } else {
      // use the existing value for verifyInstall if the app exists, otherwise default to true
      verifyInstall = app ? app.verifyInstall : true;
    }

    return (
      <div>
        <SettingsPageHeader title={this.getHeaderTitle()} />
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
            verifyInstall, // need to overwrite the value in app for internal if it is true
          }}
          model={this.form}
          onSubmitSuccess={this.handleSubmitSuccess}
          onSubmitError={this.handleSubmitError}
          onFieldChange={this.onFieldChange}
        >
          <Observer>
            {() => {
              const webhookDisabled =
                this.isInternal && !this.form.getValue('webhookUrl');
              return (
                <React.Fragment>
                  <JsonForm additionalFieldProps={{webhookDisabled}} forms={forms} />
                  {this.getAvatarChooser(true)}
                  {this.getAvatarChooser(false)}
                  <PermissionsObserver
                    webhookDisabled={webhookDisabled}
                    appPublished={app ? app.status === 'published' : false}
                    scopes={scopes}
                    events={events}
                  />
                </React.Fragment>
              );
            }}
          </Observer>

          {app && app.status === 'internal' && (
            <Panel>
              <PanelHeader hasButtons>
                {t('Tokens')}
                <Button
                  size="xsmall"
                  icon={<IconAdd size="xs" isCircled />}
                  onClick={evt => this.onAddToken(evt)}
                  data-test-id="token-add"
                  type="button"
                >
                  {t('New Token')}
                </Button>
              </PanelHeader>
              <PanelBody>{this.renderTokens()}</PanelBody>
            </Panel>
          )}

          {app && (
            <Panel>
              <PanelHeader>{t('Credentials')}</PanelHeader>
              <PanelBody>
                {app.status !== 'internal' && (
                  <FormField name="clientId" label="Client ID">
                    {({value}) => (
                      <TextCopyInput>
                        {getDynamicText({value, fixed: 'CI_CLIENT_ID'})}
                      </TextCopyInput>
                    )}
                  </FormField>
                )}
                <FormField name="clientSecret" label="Client Secret">
                  {({value}) =>
                    value ? (
                      <Tooltip
                        disabled={this.showAuthInfo}
                        position="right"
                        containerDisplayMode="inline"
                        title={t(
                          'You do not have access to view these credentials because the permissions for this integration exceed those of your role.'
                        )}
                      >
                        <TextCopyInput>
                          {getDynamicText({value, fixed: 'CI_CLIENT_SECRET'})}
                        </TextCopyInput>
                      </Tooltip>
                    ) : (
                      <em>hidden</em>
                    )
                  }
                </FormField>
              </PanelBody>
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
  color: ${p => p.theme.gray300};
  margin-bottom: 2px;
`;

const CreatedDate = styled('div')`
  display: flex;
  flex-direction: column;
  font-size: 14px;
  margin: 0 10px;
`;

const AvatarPreview = styled('div')`
  flex: 1;
  display: grid;
  grid: 25px 25px / 50px 1fr;
`;

const StyledPreviewAvatar = styled(Avatar)`
  grid-area: 1 / 1 / 3 / 2;
  justify-self: end;
`;

const AvatarPreviewTitle = styled('span')`
  display: block;
  grid-area: 1 / 2 / 2 / 3;
  padding-left: ${space(2)};
  font-weight: bold;
`;

const AvatarPreviewText = styled('span')`
  display: block;
  grid-area: 2 / 2 / 3 / 3;
  padding-left: ${space(2)};
`;
