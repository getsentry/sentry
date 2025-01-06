import {Fragment} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import {Observer} from 'mobx-react';
import scrollToElement from 'scroll-to-element';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {
  addSentryAppToken,
  removeSentryAppToken,
} from 'sentry/actionCreators/sentryAppTokens';
import {Alert} from 'sentry/components/alert';
import Avatar from 'sentry/components/avatar';
import type {Model} from 'sentry/components/avatarChooser';
import AvatarChooser from 'sentry/components/avatarChooser';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import EmptyMessage from 'sentry/components/emptyMessage';
import Form from 'sentry/components/forms/form';
import FormField from 'sentry/components/forms/formField';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {FieldValue} from 'sentry/components/forms/model';
import FormModel from 'sentry/components/forms/model';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import TextCopyInput from 'sentry/components/textCopyInput';
import {Tooltip} from 'sentry/components/tooltip';
import {SENTRY_APP_PERMISSIONS} from 'sentry/constants';
import {
  internalIntegrationForms,
  publicIntegrationForms,
} from 'sentry/data/forms/sentryApplication';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Scope} from 'sentry/types/core';
import type {SentryApp} from 'sentry/types/integrations';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {InternalAppApiToken, NewInternalAppApiToken} from 'sentry/types/user';
import getDynamicText from 'sentry/utils/getDynamicText';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import withOrganization from 'sentry/utils/withOrganization';
import ApiTokenRow from 'sentry/views/settings/account/apiTokenRow';
import NewTokenHandler from 'sentry/views/settings/components/newTokenHandler';
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

/**
 * We need to map the API response errors to the actual form fields.
 * We do this by pulling out scopes and mapping each scope error to the correct input.
 * @param {Object} responseJSON
 */
const mapFormErrors = (responseJSON?: any) => {
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
}

type Props = RouteComponentProps<{appSlug?: string}, {}> & {
  organization: Organization;
};

type State = DeprecatedAsyncComponent['state'] & {
  app: SentryApp | null;
  newTokens: NewInternalAppApiToken[];
  tokens: InternalAppApiToken[];
};

class SentryApplicationDetails extends DeprecatedAsyncComponent<Props, State> {
  form = new SentryAppFormModel({mapFormErrors});

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      app: null,
      tokens: [],
      newTokens: [],
    };
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {appSlug} = this.props.params;
    if (appSlug) {
      const endpoints = [['app', `/sentry-apps/${appSlug}/`]];
      if (this.hasTokenAccess) {
        endpoints.push(['tokens', `/sentry-apps/${appSlug}/api-tokens/`]);
      }
      return endpoints as [string, string][];
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
    const {organization, router} = this.props;
    const type = this.isInternal ? 'internal' : 'public';
    const baseUrl = `/settings/${organization.slug}/developer-settings/`;
    const url = app ? `${baseUrl}?type=${type}` : `${baseUrl}${data.slug}/`;
    if (app) {
      addSuccessMessage(t('%s successfully saved.', data.name));
    } else {
      addSuccessMessage(t('%s successfully created.', data.name));
    }
    router.push(normalizeUrl(url));
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

  get hasTokenAccess() {
    return this.props.organization.access.includes('org:write');
  }

  get isInternal() {
    const {app} = this.state;
    if (app) {
      // if we are editing an existing app, check the status of the app
      return app.status === 'internal';
    }
    return this.props.location.pathname.endsWith('new-internal/');
  }

  get showAuthInfo() {
    const {app} = this.state;
    return !(app?.clientSecret && app.clientSecret[0] === '*');
  }

  onAddToken = async (evt: React.MouseEvent): Promise<void> => {
    evt.preventDefault();
    const {app, newTokens} = this.state;
    if (!app) {
      return;
    }

    const api = this.api;

    const token = await addSentryAppToken(api, app);
    const updatedNewTokens = newTokens.concat(token);
    this.setState({newTokens: updatedNewTokens});
  };

  onRemoveToken = async (token: InternalAppApiToken) => {
    const {app, tokens} = this.state;
    if (!app) {
      return;
    }

    const api = this.api;
    const newTokens = tokens.filter(tok => tok.id !== token.id);

    await removeSentryAppToken(api, app, token.id);
    this.setState({tokens: newTokens});
  };

  handleFinishNewToken = (newToken: NewInternalAppApiToken) => {
    const {tokens, newTokens} = this.state;
    const updatedNewTokens = newTokens.filter(token => token.id !== newToken.id);
    const updatedTokens = tokens.concat(newToken as InternalAppApiToken);
    this.setState({tokens: updatedTokens, newTokens: updatedNewTokens});
  };

  renderTokens = () => {
    const {tokens, newTokens} = this.state;
    if (!this.hasTokenAccess) {
      return (
        <EmptyMessage description={t('You do not have access to view these tokens.')} />
      );
    }
    if (tokens.length < 1 && newTokens.length < 1) {
      return <EmptyMessage description={t('No tokens created yet.')} />;
    }
    const tokensToDisplay = tokens.map(token => (
      <ApiTokenRow
        data-test-id="api-token"
        key={token.id}
        token={token}
        onRemove={this.onRemoveToken}
      />
    ));
    tokensToDisplay.push(
      ...newTokens.map(newToken => (
        <NewTokenHandler
          data-test-id="new-api-token"
          key={newToken.id}
          token={getDynamicText({value: newToken.token, fixed: 'ORG_AUTH_TOKEN'})}
          handleGoBack={() => this.handleFinishNewToken(newToken)}
        />
      ))
    );

    return tokensToDisplay;
  };

  rotateClientSecret = async () => {
    try {
      const rotateResponse = await this.api.requestPromise(
        `/sentry-apps/${this.props.params.appSlug}/rotate-secret/`,
        {
          method: 'POST',
        }
      );
      openModal(({Body, Header}) => (
        <Fragment>
          <Header>{t('Your new Client Secret')}</Header>
          <Body>
            <Alert type="info" showIcon>
              {t('This will be the only time your client secret is visible!')}
            </Alert>
            <TextCopyInput aria-label={t('new-client-secret')}>
              {rotateResponse.clientSecret}
            </TextCopyInput>
          </Body>
        </Fragment>
      ));
    } catch {
      addErrorMessage(t('Error rotating secret'));
    }
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
            organization: this.props.organization.slug,
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
                <Fragment>
                  <JsonForm additionalFieldProps={{webhookDisabled}} forms={forms} />
                  {this.getAvatarChooser(true)}
                  {this.getAvatarChooser(false)}
                  <PermissionsObserver
                    webhookDisabled={webhookDisabled}
                    appPublished={app ? app.status === 'published' : false}
                    scopes={scopes}
                    events={events}
                    newApp={!app}
                  />
                </Fragment>
              );
            }}
          </Observer>

          {app && app.status === 'internal' && (
            <Panel>
              {this.hasTokenAccess ? (
                <PanelHeader hasButtons>
                  {t('Tokens')}
                  <Button
                    size="xs"
                    icon={<IconAdd isCircled />}
                    onClick={evt => this.onAddToken(evt)}
                    data-test-id="token-add"
                  >
                    {t('New Token')}
                  </Button>
                </PanelHeader>
              ) : (
                <PanelHeader>{t('Tokens')}</PanelHeader>
              )}
              <PanelBody>{this.renderTokens()}</PanelBody>
            </Panel>
          )}

          {app && (
            <Panel>
              <PanelHeader>{t('Credentials')}</PanelHeader>
              <PanelBody>
                {app.status !== 'internal' && (
                  <FormField name="clientId" label="Client ID">
                    {({value, id}) => (
                      <TextCopyInput id={id}>
                        {getDynamicText({value, fixed: 'CI_CLIENT_ID'})}
                      </TextCopyInput>
                    )}
                  </FormField>
                )}
                <FormField
                  name="clientSecret"
                  label="Client Secret"
                  help={t(`Your secret is only available briefly after integration creation. Make
                    sure to save this value!`)}
                >
                  {({value, id}) =>
                    value ? (
                      <Tooltip
                        disabled={this.showAuthInfo}
                        position="right"
                        containerDisplayMode="inline"
                        title={t(
                          'Only Manager or Owner can view these credentials, or the permissions for this integration exceed those of your role.'
                        )}
                      >
                        <TextCopyInput id={id}>
                          {getDynamicText({value, fixed: 'CI_CLIENT_SECRET'})}
                        </TextCopyInput>
                      </Tooltip>
                    ) : (
                      <ClientSecret>
                        <HiddenSecret>{t('hidden')}</HiddenSecret>
                        {this.hasTokenAccess ? (
                          <Confirm
                            onConfirm={this.rotateClientSecret}
                            message={t(
                              'Are you sure you want to rotate the client secret? The current one will not be usable anymore, and this cannot be undone.'
                            )}
                          >
                            <Button priority="danger">Rotate client secret</Button>
                          </Confirm>
                        ) : undefined}
                      </ClientSecret>
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

export default withOrganization(SentryApplicationDetails);

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
  font-weight: ${p => p.theme.fontWeightBold};
`;

const AvatarPreviewText = styled('span')`
  display: block;
  grid-area: 2 / 2 / 3 / 3;
  padding-left: ${space(2)};
`;

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
