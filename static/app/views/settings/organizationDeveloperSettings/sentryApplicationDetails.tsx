import {Fragment, useState} from 'react';
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
import Avatar from 'sentry/components/avatar';
import type {Model} from 'sentry/components/avatarChooser';
import AvatarChooser from 'sentry/components/avatarChooser';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import {Alert} from 'sentry/components/core/alert';
import EmptyMessage from 'sentry/components/emptyMessage';
import Form from 'sentry/components/forms/form';
import FormField from 'sentry/components/forms/formField';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {FieldValue} from 'sentry/components/forms/model';
import FormModel from 'sentry/components/forms/model';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
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
import type {SentryApp, SentryAppAvatar} from 'sentry/types/integrations';
import type {InternalAppApiToken, NewInternalAppApiToken} from 'sentry/types/user';
import getDynamicText from 'sentry/utils/getDynamicText';
import {
  type ApiQueryKey,
  setApiQueryData,
  useApiQuery,
  useQueryClient,
} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
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
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        data[k] = v;
      }
      return data;
    }, {});
  }
}

type Props = {appSlug?: string};

function makeSentryAppQueryKey(appSlug?: string): ApiQueryKey {
  return [`/sentry-apps/${appSlug}/`];
}

function makeSentryAppApiTokensQueryKey(appSlug?: string): ApiQueryKey {
  return [`/sentry-apps/${appSlug}/api-tokens/`];
}

export default function SentryApplicationDetails(props: Props) {
  const {appSlug} = props;
  const isEditingApp = !!appSlug;
  const [form] = useState<SentryAppFormModel>(
    () => new SentryAppFormModel({mapFormErrors})
  );

  const organization = useOrganization();
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const SENTRY_APP_QUERY_KEY = makeSentryAppQueryKey(appSlug);
  const SENTRY_APP_API_TOKENS_QUERY_KEY = makeSentryAppApiTokensQueryKey(appSlug);

  const {
    data: app = undefined,
    isPending,
    isError,
    refetch,
  } = useApiQuery<SentryApp>(SENTRY_APP_QUERY_KEY, {
    staleTime: Infinity,
    enabled: isEditingApp,
  });
  const {data: tokens = []} = useApiQuery<InternalAppApiToken[]>(
    SENTRY_APP_API_TOKENS_QUERY_KEY,
    {
      staleTime: Infinity,
      enabled: isEditingApp,
    }
  );
  const [newTokens, setNewTokens] = useState<NewInternalAppApiToken[]>([]);

  const hasTokenAccess = () => {
    return organization.access.includes('org:write');
  };

  const isInternal = () => {
    if (app) {
      // if we are editing an existing app, check the status of the app
      return app.status === 'internal';
    }
    return location.pathname.endsWith('new-internal/');
  };

  const showAuthInfo = !(app?.clientSecret && app.clientSecret[0] === '*');

  const headerTitle = () => {
    const action = app ? 'Edit' : 'Create';
    const type = isInternal() ? 'Internal' : 'Public';
    return tct('[action] [type] Integration', {action, type});
  };

  // Events may come from the API as "issue.created" when we just want "issue" here.
  function normalize(events: any) {
    if (events.length === 0) {
      return events;
    }

    return events.map((e: any) => e.split('.').shift());
  }

  const handleSubmitSuccess = (data: SentryApp) => {
    const type = isInternal() ? 'internal' : 'public';
    const baseUrl = `/settings/${organization.slug}/developer-settings/`;
    const url = app ? `${baseUrl}?type=${type}` : `${baseUrl}${data.slug}/`;
    if (app) {
      addSuccessMessage(t('%s successfully saved.', data.name));
      refetch();
    } else {
      addSuccessMessage(t('%s successfully created.', data.name));
    }
    navigate(normalizeUrl(url));
  };

  const handleSubmitError = (err: any) => {
    let errorMessage = t('Unknown Error');
    if (err.status >= 400 && err.status < 500) {
      errorMessage = err?.responseJSON.detail ?? errorMessage;
    }
    addErrorMessage(errorMessage);
    if (form.formErrors) {
      const firstErrorFieldId = Object.keys(form.formErrors)[0];

      if (firstErrorFieldId) {
        scrollToElement(`#${firstErrorFieldId}`, {
          align: 'middle',
          offset: 0,
        });
      }
    }
  };

  async function onAddToken(evt: React.MouseEvent): Promise<void> {
    evt.preventDefault();
    if (!app) {
      return;
    }
    const token = await addSentryAppToken(api, app);
    const updatedNewTokens = newTokens.concat(token);
    setNewTokens(updatedNewTokens);
  }

  const onRemoveToken = async (token: InternalAppApiToken) => {
    if (!app) {
      return;
    }
    const updatedTokens = tokens.filter(tok => tok.id !== token.id);
    await removeSentryAppToken(api, app, token.id);
    setApiQueryData(queryClient, SENTRY_APP_API_TOKENS_QUERY_KEY, updatedTokens);
  };

  const handleFinishNewToken = (newToken: NewInternalAppApiToken) => {
    const updatedNewTokens = newTokens.filter(token => token.id !== newToken.id);
    const updatedTokens = tokens.concat(newToken as InternalAppApiToken);
    setApiQueryData(queryClient, SENTRY_APP_API_TOKENS_QUERY_KEY, updatedTokens);
    setNewTokens(updatedNewTokens);
  };

  const renderTokens = () => {
    if (!hasTokenAccess) {
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
        onRemove={onRemoveToken}
      />
    ));
    tokensToDisplay.push(
      ...newTokens.map(newToken => (
        <NewTokenHandler
          data-test-id="new-api-token"
          key={newToken.id}
          token={getDynamicText({value: newToken.token, fixed: 'ORG_AUTH_TOKEN'})}
          handleGoBack={() => handleFinishNewToken(newToken)}
        />
      ))
    );

    return tokensToDisplay;
  };

  async function rotateClientSecret() {
    try {
      const rotateResponse = await api.requestPromise(
        `/sentry-apps/${appSlug}/rotate-secret/`,
        {
          method: 'POST',
        }
      );
      openModal(({Body, Header}) => (
        <Fragment>
          <Header>{t('Your new Client Secret')}</Header>
          <Body>
            <Alert.Container>
              <Alert type="info" showIcon>
                {t('This will be the only time your client secret is visible!')}
              </Alert>
            </Alert.Container>
            <TextCopyInput aria-label={t('new-client-secret')}>
              {rotateResponse.clientSecret}
            </TextCopyInput>
          </Body>
        </Fragment>
      ));
    } catch {
      addErrorMessage(t('Error rotating secret'));
    }
  }

  const onFieldChange = (name: string, value: FieldValue): void => {
    if (name === 'webhookUrl' && !value && isInternal()) {
      // if no webhook, then set isAlertable to false
      form.setValue('isAlertable', false);
    }
  };

  const addAvatar = ({avatar}: Model) => {
    if (app && avatar) {
      const avatars =
        app?.avatars?.filter(prevAvatar => prevAvatar.color !== avatar.color) || [];

      avatars.push(avatar as SentryAppAvatar);
      setApiQueryData(queryClient, SENTRY_APP_QUERY_KEY, {...app, avatars});
    }
  };

  const getAvatarModel = (isColor: boolean): Model => {
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

  const getAvatarPreview = (isColor: boolean) => {
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

  const getAvatarChooser = (isColor: boolean) => {
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
        model={getAvatarModel(isColor)}
        onSave={addAvatar}
        title={isColor ? t('Logo') : t('Small Icon')}
        help={AVATAR_STYLES[avatarStyle].help.concat(
          isInternal() ? '' : t(' Required for publishing.')
        )}
        savedDataUrl={undefined}
        defaultChoice={{
          allowDefault: true,
          choiceText: isColor ? t('Default logo') : t('Default small icon'),
          preview: getAvatarPreview(isColor),
        }}
      />
    );
  };

  const scopes = (app && [...app.scopes]) || [];
  const events = (app && normalize(app.events)) || [];
  const method = app ? 'PUT' : 'POST';
  const endpoint = app ? `/sentry-apps/${app.slug}/` : '/sentry-apps/';

  const forms = isInternal() ? internalIntegrationForms : publicIntegrationForms;
  let verifyInstall: boolean;
  if (isInternal()) {
    // force verifyInstall to false for all internal apps
    verifyInstall = false;
  } else {
    // use the existing value for verifyInstall if the app exists, otherwise default to true
    verifyInstall = app ? app.verifyInstall : true;
  }

  if (isEditingApp && isPending) {
    return (
      <Fragment>
        <SettingsPageHeader title={headerTitle()} />
        <LoadingIndicator />
      </Fragment>
    );
  }

  if (isEditingApp && isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <div>
      <SettingsPageHeader title={headerTitle()} />
      <Form
        apiMethod={method}
        apiEndpoint={endpoint}
        allowUndo
        initialData={{
          organization: organization.slug,
          isAlertable: false,
          isInternal: isInternal(),
          schema: {},
          scopes: [],
          ...app,
          verifyInstall, // need to overwrite the value in app for internal if it is true
        }}
        model={form}
        onSubmitSuccess={handleSubmitSuccess}
        onSubmitError={handleSubmitError}
        onFieldChange={onFieldChange}
      >
        <Observer>
          {() => {
            const webhookDisabled = isInternal() && !form.getValue('webhookUrl');
            return (
              <Fragment>
                <JsonForm additionalFieldProps={{webhookDisabled}} forms={forms} />
                {getAvatarChooser(true)}
                {getAvatarChooser(false)}
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
            {hasTokenAccess() ? (
              <PanelHeader hasButtons>
                {t('Tokens')}
                <Button
                  size="xs"
                  icon={<IconAdd isCircled />}
                  onClick={evt => onAddToken(evt)}
                  data-test-id="token-add"
                >
                  {t('New Token')}
                </Button>
              </PanelHeader>
            ) : (
              <PanelHeader>{t('Tokens')}</PanelHeader>
            )}
            <PanelBody>{renderTokens()}</PanelBody>
          </Panel>
        )}

        {app && (
          <Panel>
            <PanelHeader>{t('Credentials')}</PanelHeader>
            <PanelBody>
              {app.status !== 'internal' && (
                <FormField name="clientId" label="Client ID">
                  {({value, id}: any) => (
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
                {({value, id}: any) =>
                  value ? (
                    <Tooltip
                      disabled={showAuthInfo}
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
                      {hasTokenAccess() ? (
                        <Confirm
                          onConfirm={rotateClientSecret}
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
