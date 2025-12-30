import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import {Observer} from 'mobx-react-lite';
import scrollToElement from 'scroll-to-element';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {
  addSentryAppToken,
  removeSentryAppToken,
} from 'sentry/actionCreators/sentryAppTokens';
import AvatarChooser from 'sentry/components/avatarChooser';
import Confirm from 'sentry/components/confirm';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import EmptyMessage from 'sentry/components/emptyMessage';
import Form from 'sentry/components/forms/form';
import FormField from 'sentry/components/forms/formField';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {FieldValue} from 'sentry/components/forms/model';
import FormModel from 'sentry/components/forms/model';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {PanelTable} from 'sentry/components/panels/panelTable';
import TextCopyInput from 'sentry/components/textCopyInput';
import {SENTRY_APP_PERMISSIONS} from 'sentry/constants';
import {
  internalIntegrationForms,
  publicIntegrationForms,
} from 'sentry/data/forms/sentryApplication';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Avatar, Scope} from 'sentry/types/core';
import type {SentryApp, SentryAppAvatar} from 'sentry/types/integrations';
import type {InternalAppApiToken, NewInternalAppApiToken} from 'sentry/types/user';
import {
  setApiQueryData,
  useApiQuery,
  useQueryClient,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import ApiTokenRow from 'sentry/views/settings/account/apiTokenRow';
import {displayNewToken} from 'sentry/views/settings/components/newTokenHandler';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import PermissionsObserver from 'sentry/views/settings/organizationDeveloperSettings/permissionsObserver';

type Resource = 'Project' | 'Team' | 'Release' | 'Event' | 'Organization' | 'Member';

const AVATAR_STYLES = {
  color: {
    label: t('Default logo'),
    description: t('The default icon for integrations'),
    help: t('Image must be between 256px by 256px and 1024px by 1024px.'),
  },
  simple: {
    label: t('Default small icon'),
    description: tct('This is a silhouette icon used only for [uiDocs:UI Components]', {
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

const makeSentryAppQueryKey = (appSlug?: string): ApiQueryKey => {
  return [`/sentry-apps/${appSlug}/`];
};

const makeSentryAppApiTokensQueryKey = (appSlug?: string): ApiQueryKey => {
  return [`/sentry-apps/${appSlug}/api-tokens/`];
};

export default function SentryApplicationDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const {appSlug} = useParams<{appSlug: string}>();
  const organization = useOrganization();
  const [form] = useState<SentryAppFormModel>(() => new SentryAppFormModel());

  const isEditingApp = !!appSlug;

  const api = useApi();
  const queryClient = useQueryClient();

  const SENTRY_APP_QUERY_KEY = makeSentryAppQueryKey(appSlug);
  const SENTRY_APP_API_TOKENS_QUERY_KEY = makeSentryAppApiTokensQueryKey(appSlug);

  const {
    data: app = undefined,
    isPending,
    isError,
    refetch,
  } = useApiQuery<SentryApp>(SENTRY_APP_QUERY_KEY, {
    staleTime: 30000,
    enabled: isEditingApp,
  });
  const {data: tokens = []} = useApiQuery<InternalAppApiToken[]>(
    SENTRY_APP_API_TOKENS_QUERY_KEY,
    {
      staleTime: 30000,
      enabled: isEditingApp,
    }
  );
  const [newTokens, setNewTokens] = useState<NewInternalAppApiToken[]>([]);

  // Events may come from the API as "issue.created" when we just want "issue" here.
  const normalize = (events: any) => {
    if (events.length === 0) {
      return events;
    }

    return events.map((e: any) => e.split('.').shift());
  };

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

  const showAuthInfo = () => !(app?.clientSecret && app.clientSecret[0] === '*');

  const headerTitle = () => {
    const action = app ? 'Edit' : 'Create';
    const type = isInternal() ? 'Internal' : 'Public';
    return tct('[action] [type] Integration', {action, type});
  };

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

  const onAddToken = async (evt: React.MouseEvent): Promise<void> => {
    evt.preventDefault();
    if (!app) {
      return;
    }
    const token = await addSentryAppToken(api, app);
    const updatedNewTokens = newTokens.concat(token);
    setNewTokens(updatedNewTokens);
    displayNewToken(token.token, () => handleFinishNewToken(token));
  };

  const handleFinishNewToken = (newToken: NewInternalAppApiToken) => {
    const updatedNewTokens = newTokens.filter(token => token.id !== newToken.id);
    const updatedTokens = tokens.concat(newToken as InternalAppApiToken);
    setApiQueryData(queryClient, SENTRY_APP_API_TOKENS_QUERY_KEY, updatedTokens);
    setNewTokens(updatedNewTokens);
  };

  const onRemoveToken = async (token: InternalAppApiToken) => {
    if (!app) {
      return;
    }
    const updatedTokens = tokens.filter(tok => tok.id !== token.id);
    await removeSentryAppToken(api, app, token.id);
    setApiQueryData(queryClient, SENTRY_APP_API_TOKENS_QUERY_KEY, updatedTokens);
  };

  const renderTokens = () => {
    if (!hasTokenAccess) {
      return (
        <EmptyMessage>{t('You do not have access to view these tokens.')}</EmptyMessage>
      );
    }
    if (tokens.length < 1 && newTokens.length < 1) {
      return <EmptyMessage>{t('No tokens created yet.')}</EmptyMessage>;
    }
    const tokensToDisplay = tokens.map(token => (
      <ApiTokenRow
        data-test-id="api-token"
        key={token.id}
        token={token}
        onRemove={onRemoveToken}
      />
    ));

    return tokensToDisplay;
  };

  const rotateClientSecret = async () => {
    const rotateResponse = await api.requestPromise(
      `/sentry-apps/${appSlug}/rotate-secret/`,
      {
        method: 'POST',
      }
    );

    // Ensures that the modal is opened after the confirmation modal closes itself
    requestAnimationFrame(() => {
      openModal(({Body, Header}) => (
        <Fragment>
          <Header>{t('Your new Client Secret')}</Header>
          <Body>
            <Alert.Container>
              <Alert variant="info">
                {t('This will be the only time your client secret is visible!')}
              </Alert>
            </Alert.Container>
            <TextCopyInput aria-label={t('new-client-secret')}>
              {rotateResponse.clientSecret}
            </TextCopyInput>
          </Body>
        </Fragment>
      ));
    });
  };

  const onFieldChange = (name: string, value: FieldValue): void => {
    if (name === 'webhookUrl' && !value && isInternal()) {
      // if no webhook, then set isAlertable to false
      form.setValue('isAlertable', false);
    }
  };

  const addAvatar = ({avatar}: {avatar?: Avatar}) => {
    if (app && avatar) {
      const avatars =
        app?.avatars?.filter(prevAvatar => prevAvatar.color !== avatar.color) || [];

      avatars.push(avatar as SentryAppAvatar);
      setApiQueryData(queryClient, SENTRY_APP_QUERY_KEY, {...app, avatars});
    }
  };

  const getAvatarChooser = (isColor: boolean) => {
    if (!app) {
      return null;
    }
    const avatarStyle = isColor ? 'color' : 'simple';
    const styleProps = AVATAR_STYLES[avatarStyle];

    return (
      <AvatarChooser
        endpoint={`/sentry-apps/${app.slug}/avatar/`}
        supportedTypes={['default', 'upload']}
        type={isColor ? 'sentryAppColor' : 'sentryAppSimple'}
        model={app}
        onSave={addAvatar}
        title={isColor ? t('Logo') : t('Small Icon')}
        help={styleProps.help.concat(isInternal() ? '' : t(' Required for publishing.'))}
        defaultChoice={{
          label: styleProps.label,
          description: styleProps.description,
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

  return (
    <div>
      <SettingsPageHeader title={headerTitle()} />
      {isEditingApp && isPending ? (
        <LoadingIndicator />
      ) : isEditingApp && isError ? (
        <LoadingError onRetry={refetch} />
      ) : (
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
          mapFormErrors={mapFormErrors}
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
            <PanelTable
              headers={[
                t('Token'),
                t('Created On'),
                t('Scopes'),
                <AddTokenHeader key="token-add">
                  <Button
                    size="xs"
                    icon={<IconAdd />}
                    onClick={evt => onAddToken(evt)}
                    data-test-id="token-add"
                  >
                    {t('New Token')}
                  </Button>
                </AddTokenHeader>,
              ]}
              isEmpty={tokens.length === 0}
              emptyMessage={t("You haven't created any authentication tokens yet.")}
            >
              {renderTokens()}
            </PanelTable>
          )}

          {app && (
            <Panel>
              <PanelHeader>{t('Credentials')}</PanelHeader>
              <PanelBody>
                {app.status !== 'internal' && (
                  <FormField name="clientId" label="Client ID">
                    {({value, id}: any) => <TextCopyInput id={id}>{value}</TextCopyInput>}
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
                        disabled={showAuthInfo()}
                        position="right"
                        containerDisplayMode="inline"
                        title={t(
                          'Only Manager or Owner can view these credentials, or the permissions for this integration exceed those of your role.'
                        )}
                      >
                        <TextCopyInput id={id}>{value}</TextCopyInput>
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
                            errorMessage={t('Error rotating secret')}
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
      )}
    </div>
  );
}

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

const AddTokenHeader = styled('div')`
  margin: -${space(1)} 0;
  display: flex;
  justify-content: flex-end;
`;
