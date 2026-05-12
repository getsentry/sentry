import {Fragment, useState, type MouseEvent} from 'react';
import styled from '@emotion/styled';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {
  sentryAppApiOptions,
  sentryAppsApiOptions,
} from 'sentry/actionCreators/sentryApps';
import {AvatarChooser} from 'sentry/components/avatarChooser';
import {Confirm} from 'sentry/components/confirm';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import {FormField} from 'sentry/components/forms/formField';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {TextCopyInput} from 'sentry/components/textCopyInput';
import {
  ALLOWED_SCOPES,
  CONTINUOUS_INTEGRATION_SENTRY_APP_PERMISSION,
  SENTRY_APP_PERMISSIONS,
} from 'sentry/constants';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Avatar} from 'sentry/types/core';
import type {
  PermissionResource,
  SentryApp,
  SentryAppAvatar,
  WebhookEvent,
} from 'sentry/types/integrations';
import type {InternalAppApiToken, NewInternalAppApiToken} from 'sentry/types/user';
import {convertMultilineFieldValue, extractMultilineFields} from 'sentry/utils';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {
  fetchMutation,
  setApiQueryData,
  useApiQuery,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {ApiTokenRow} from 'sentry/views/settings/account/apiTokenRow';
import {displayNewToken} from 'sentry/views/settings/components/newTokenHandler';
import {BreadcrumbTitle} from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {EVENT_CHOICES} from 'sentry/views/settings/organizationDeveloperSettings/constants';
import {PermissionsObserver} from 'sentry/views/settings/organizationDeveloperSettings/permissionsObserver';

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

const sentryAppFormSchema = z
  .object({
    name: z.string(),
    author: z.string(),
    webhookUrl: z.string(),
    redirectUrl: z.string(),
    verifyInstall: z.boolean(),
    isAlertable: z.boolean(),
    schema: z.string(),
    overview: z.string(),
    allowedOrigins: z.string(),
    organization: z.string(),
    isInternal: z.boolean(),
    scopes: z.array(z.enum(ALLOWED_SCOPES)),
    events: z.array(z.enum(EVENT_CHOICES)),
  })
  .superRefine((data, ctx) => {
    if (!data.name.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: t('This field is required'),
        path: ['name'],
      });
    }

    if (!data.isInternal && !data.author.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: t('This field is required'),
        path: ['author'],
      });
    }

    if (!data.isInternal && !data.webhookUrl.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: t('This field is required'),
        path: ['webhookUrl'],
      });
    }

    if (data.schema.trim()) {
      try {
        JSON.parse(data.schema);
      } catch {
        ctx.addIssue({
          code: 'custom',
          message: t('Invalid JSON'),
          path: ['schema'],
        });
      }
    }
  });

function getResourceFromScope(scope: string): PermissionResource | undefined {
  for (const permObj of SENTRY_APP_PERMISSIONS) {
    const allScopes: string[] = Object.values(permObj.choices).flatMap(
      choice => choice?.scopes ?? []
    );
    if (allScopes.includes(scope)) {
      return permObj.resource;
    }
  }
  return undefined;
}

type ScopeErrors = {
  permissions: Partial<Record<PermissionResource, string>>;
  continuousIntegration?: string;
};

/**
 * Backend rejects oversized scope requests with messages like
 * `"Requested permission of member:write exceeds…"`. Map each one onto its
 * permission resource (or the CI checkbox) so the error can render under
 * the matching control, matching the legacy form's behavior.
 */
function mapScopeErrors(scopeErrors: unknown): ScopeErrors {
  const result: ScopeErrors = {permissions: {}};
  if (!Array.isArray(scopeErrors)) {
    return result;
  }
  for (const message of scopeErrors) {
    if (typeof message !== 'string') continue;
    const match = message.match(/Requested permission of (\w+:\w+)/);
    if (!match) continue;
    const scope = match[1]!;
    if (scope === CONTINUOUS_INTEGRATION_SENTRY_APP_PERMISSION.scope) {
      result.continuousIntegration ??= message;
      continue;
    }
    const resource = getResourceFromScope(scope);
    if (resource && !result.permissions[resource]) {
      result.permissions[resource] = message;
    }
  }
  return result;
}

type SaveSentryAppPayload = {
  allowedOrigins: string[];
  events: string[];
  isAlertable: boolean;
  isInternal: boolean;
  name: string;
  organization: string;
  schema: Record<string, unknown>;
  scopes: string[];
  verifyInstall: boolean;
  author?: string | null;
  overview?: string;
  redirectUrl?: string;
  webhookUrl?: string;
};

type RotateSecretResponse = {
  clientSecret: string;
};

const makeSentryAppApiTokensQueryKey = (appSlug: string): ApiQueryKey => {
  return [
    getApiUrl('/sentry-apps/$sentryAppIdOrSlug/api-tokens/', {
      path: {sentryAppIdOrSlug: appSlug},
    }),
  ];
};

function getSchemaFieldValue(schema: SentryApp['schema'] | null | undefined) {
  const formattedSchema = JSON.stringify(schema ?? {}, null, 2);
  return formattedSchema === '{}' ? '' : formattedSchema;
}

export default function SentryApplicationDetails() {
  const location = useLocation();
  const {appSlug} = useParams<{appSlug: string}>();
  const organization = useOrganization();
  const routes = useRoutes();
  const hasPageFrame = useHasPageFrameFeature();
  const queryClient = useQueryClient();

  const isInternalRoute = location.pathname.endsWith('new-internal/');

  const sentryAppQueryOptions = sentryAppApiOptions({appSlug: appSlug ?? null});

  const {
    data: app,
    isLoading,
    isError,
    isPlaceholderData,
    refetch,
  } = useQuery({
    ...sentryAppQueryOptions,
    staleTime: 30_000,
    placeholderData: () => {
      if (!appSlug) {
        return;
      }

      const listData = queryClient.getQueryData(
        sentryAppsApiOptions({orgSlug: organization.slug}).queryKey
      );

      const found = listData?.json.find(item => item.slug === appSlug);
      return found ? {json: found, headers: {}} : undefined;
    },
  });

  const {data: tokens = []} = useApiQuery<InternalAppApiToken[]>(
    makeSentryAppApiTokensQueryKey(appSlug ?? ''),
    {staleTime: 30_000, enabled: !!appSlug}
  );

  const isInternal = app ? app.status === 'internal' : isInternalRoute;
  const headerTitle = tct('[action] [type] Integration', {
    action: app ? 'Edit' : 'Create',
    type: isInternal ? 'Internal' : 'Public',
  });

  return (
    <div>
      {hasPageFrame ? (
        <BreadcrumbTitle routes={routes} title={appSlug ? (app?.name ?? '') : t('New')} />
      ) : (
        <SettingsPageHeader title={headerTitle} />
      )}

      {isLoading || isPlaceholderData ? (
        <LoadingIndicator />
      ) : isError ? (
        <LoadingError onRetry={refetch} />
      ) : (
        <SentryApplicationForm
          app={app}
          appSlug={appSlug}
          tokens={tokens}
          isInternal={isInternal}
        />
      )}
    </div>
  );
}

function SentryApplicationForm({
  app,
  appSlug,
  tokens,
  isInternal,
}: {
  app: SentryApp | undefined;
  appSlug: string | undefined;
  isInternal: boolean;
  tokens: InternalAppApiToken[];
}) {
  const {openModal} = useModal();
  const navigate = useNavigate();
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const sentryAppQueryOptions = sentryAppApiOptions({appSlug: appSlug ?? null});

  const [newTokens, setNewTokens] = useState<NewInternalAppApiToken[]>([]);
  const [scopeErrors, setScopeErrors] = useState<ScopeErrors>({permissions: {}});

  const addTokenMutation = useMutation({
    mutationFn: (sentryAppSlug: string) =>
      fetchMutation<NewInternalAppApiToken>({
        url: `/sentry-apps/${sentryAppSlug}/api-tokens/`,
        method: 'POST',
      }),
    onMutate: () => {
      addLoadingMessage(t('Adding token...'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Token successfully added.'));
    },
    onError: () => {
      addErrorMessage(t('Unable to create token'));
    },
  });

  const removeTokenMutation = useMutation({
    mutationFn: ({sentryAppSlug, tokenId}: {sentryAppSlug: string; tokenId: string}) =>
      fetchMutation({
        url: `/sentry-apps/${sentryAppSlug}/api-tokens/${tokenId}/`,
        method: 'DELETE',
      }),
    onMutate: () => {
      addLoadingMessage(t('Removing token...'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Token successfully deleted.'));
    },
    onError: () => {
      addErrorMessage(t('Unable to delete token'));
    },
  });

  const rotateClientSecretMutation = useMutation({
    mutationFn: (sentryAppSlug: string) =>
      fetchMutation<RotateSecretResponse>({
        url: `/sentry-apps/${sentryAppSlug}/rotate-secret/`,
        method: 'POST',
      }),
  });

  // Events may come from the API as "issue.created" when we just want "issue" here.
  const normalize = (events: WebhookEvent[]) => {
    if (events.length === 0) {
      return events;
    }

    return events.map(event => event.split('.').shift() as WebhookEvent);
  };

  const hasTokenAccess = () => {
    return organization.access.includes('org:write');
  };

  const showAuthInfo = () => !(app?.clientSecret?.[0] === '*');

  const handleSubmitSuccess = (data: SentryApp) => {
    const type = isInternal ? 'internal' : 'public';
    const baseUrl = `/settings/${organization.slug}/developer-settings/`;
    const url = app ? `${baseUrl}?type=${type}` : `${baseUrl}${data.slug}/`;

    if (app) {
      addSuccessMessage(t('%s successfully saved.', data.name));

      // Patch the index cache so the list doesn't flash the stale name
      // on the way back to the index page.
      queryClient.setQueryData(
        sentryAppsApiOptions({orgSlug: organization.slug}).queryKey,
        old =>
          old && {
            ...old,
            json: old.json.map(item => (item.slug === data.slug ? data : item)),
          }
      );

      queryClient.invalidateQueries({queryKey: sentryAppQueryOptions.queryKey});
    } else {
      addSuccessMessage(t('%s successfully created.', data.name));
    }

    navigate(normalizeUrl(url));
  };

  const onAddToken = async (event: MouseEvent<HTMLButtonElement>): Promise<void> => {
    event.preventDefault();
    if (!app) {
      return;
    }

    const token = await addTokenMutation.mutateAsync(app.slug);
    const updatedNewTokens = newTokens.concat(token);
    setNewTokens(updatedNewTokens);
    displayNewToken(token.token, () => handleFinishNewToken(token));
  };

  const handleFinishNewToken = (newToken: NewInternalAppApiToken) => {
    const updatedNewTokens = newTokens.filter(token => token.id !== newToken.id);
    const updatedTokens = tokens.concat(newToken);
    setApiQueryData(
      queryClient,
      makeSentryAppApiTokensQueryKey(appSlug ?? ''),
      updatedTokens
    );
    setNewTokens(updatedNewTokens);
  };

  const onRemoveToken = async (token: InternalAppApiToken) => {
    if (!app) {
      return;
    }

    const updatedTokens = tokens.filter(tok => tok.id !== token.id);
    await removeTokenMutation.mutateAsync({sentryAppSlug: app.slug, tokenId: token.id});
    setApiQueryData(
      queryClient,
      makeSentryAppApiTokensQueryKey(appSlug ?? ''),
      updatedTokens
    );
  };

  const renderTokens = () => {
    if (!hasTokenAccess()) {
      return (
        <EmptyMessage>{t('You do not have access to view these tokens.')}</EmptyMessage>
      );
    }

    if (tokens.length < 1 && newTokens.length < 1) {
      return <EmptyMessage>{t('No tokens created yet.')}</EmptyMessage>;
    }

    return tokens.map(token => (
      <ApiTokenRow
        data-test-id="api-token"
        key={token.id}
        token={token}
        onRemove={onRemoveToken}
      />
    ));
  };

  const rotateClientSecret = async () => {
    if (!app) {
      return;
    }

    const rotateResponse = await rotateClientSecretMutation.mutateAsync(app.slug);

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

  const addAvatar = ({avatar}: {avatar?: Avatar}) => {
    if (app && avatar) {
      const avatars =
        app.avatars?.filter(prevAvatar => prevAvatar.color !== avatar.color) ?? [];

      avatars.push(avatar as SentryAppAvatar);
      queryClient.setQueryData(sentryAppQueryOptions.queryKey, {
        json: {...app, avatars},
        headers: {},
      });
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
        help={styleProps.help.concat(isInternal ? '' : t(' Required for publishing.'))}
        defaultChoice={{
          label: styleProps.label,
          description: styleProps.description,
        }}
      />
    );
  };

  const defaultValues = {
    name: app?.name ?? '',
    author: app?.author ?? '',
    webhookUrl: app?.webhookUrl ?? '',
    redirectUrl: app?.redirectUrl ?? '',
    verifyInstall: isInternal ? false : (app?.verifyInstall ?? true),
    isAlertable: app?.isAlertable ?? false,
    schema: getSchemaFieldValue(app?.schema),
    overview: app?.overview ?? '',
    allowedOrigins: convertMultilineFieldValue(app?.allowedOrigins ?? []),
    organization: organization.slug,
    isInternal,
    scopes: app ? [...app.scopes] : [],
    events: app ? normalize(app.events) : [],
  };

  const saveSentryAppMutation = useMutation({
    mutationFn: (data: SaveSentryAppPayload) =>
      fetchMutation<SentryApp>({
        url: app ? `/sentry-apps/${app.slug}/` : '/sentry-apps/',
        method: app ? 'PUT' : 'POST',
        data,
      }),
    onSuccess: handleSubmitSuccess,
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {
      onDynamic: sentryAppFormSchema,
    },
    onSubmit: ({value, formApi}) => {
      setScopeErrors({permissions: {}});
      const payload: SaveSentryAppPayload = {
        name: value.name,
        organization: value.organization,
        // Clearable fields are submitted as '' (not null) because the
        // backend updater treats null as "field not provided" and skips
        // the write — sending '' lets the user actually clear the value.
        webhookUrl: value.webhookUrl,
        redirectUrl: value.redirectUrl,
        overview: value.overview,
        isAlertable: value.isAlertable,
        isInternal: value.isInternal,
        verifyInstall: value.verifyInstall,
        scopes: value.scopes,
        events: value.events,
        allowedOrigins: extractMultilineFields(value.allowedOrigins),
        schema: value.schema.trim() === '' ? {} : JSON.parse(value.schema),
        // The author parser doesn't allow_blank, so send null for empty
        // (covers internal apps with no author).
        author: value.author || null,
      };

      return saveSentryAppMutation.mutateAsync(payload).catch(error => {
        if (!(error instanceof RequestError)) {
          addErrorMessage(t('Unknown Error'));
          return;
        }
        const responseJSON = error.responseJSON ?? {};

        // Render scope errors inline under each matching control.
        const mappedScopeErrors = mapScopeErrors(responseJSON.scopes);
        setScopeErrors(mappedScopeErrors);
        const hadScopeErrors =
          Object.keys(mappedScopeErrors.permissions).length > 0 ||
          mappedScopeErrors.continuousIntegration !== undefined;

        // Attach the rest to their form fields. setFieldErrors also writes
        // the scopes/events values to those form fields, but no UI reads
        // them — scopes render inline above and events surface via toast
        // below.
        const fieldErrorsApplied = setFieldErrors(formApi, error);

        // Events errors have no inline UI yet, surface via toast.
        if (
          Array.isArray(responseJSON.events) &&
          typeof responseJSON.events[0] === 'string'
        ) {
          addErrorMessage(responseJSON.events[0]);
          return;
        }

        // Scope errors that didn't map to a permission row also have no
        // inline UI — surface the first one via toast so the user sees
        // something instead of a silent failure.
        if (
          !hadScopeErrors &&
          Array.isArray(responseJSON.scopes) &&
          typeof responseJSON.scopes[0] === 'string'
        ) {
          addErrorMessage(responseJSON.scopes[0]);
          return;
        }

        if (hadScopeErrors || fieldErrorsApplied) {
          return;
        }

        const detail =
          typeof responseJSON.detail === 'string'
            ? responseJSON.detail
            : t('Unknown Error');
        addErrorMessage(detail);
      });
    },
  });

  return (
    <form.AppForm form={form}>
      <form.FieldGroup
        title={
          isInternal ? t('Internal Integration Details') : t('Public Integration Details')
        }
      >
        <form.AppField name="name">
          {field => (
            <field.Layout.Row
              label={t('Name')}
              hintText={t('Human readable name of your Integration.')}
              required
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('e.g. My Integration')}
              />
            </field.Layout.Row>
          )}
        </form.AppField>

        {!isInternal && (
          <form.AppField name="author">
            {field => (
              <field.Layout.Row
                label={t('Author')}
                hintText={t(
                  'The company or person who built and maintains this Integration.'
                )}
                required
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={t('e.g. Acme Software')}
                />
              </field.Layout.Row>
            )}
          </form.AppField>
        )}

        <form.AppField
          name="webhookUrl"
          listeners={{
            onChange: ({value, fieldApi}) => {
              const isAlertable = fieldApi.form.getFieldValue('isAlertable');
              if (isInternal && !value && isAlertable) {
                fieldApi.form.setFieldValue('isAlertable', false);
              }
            },
          }}
        >
          {field => (
            <field.Layout.Row
              label={t('Webhook URL')}
              hintText={tct(
                'All webhook requests for your integration will be sent to this URL. Visit the [webhookDocs:documentation] to see the different types and payloads.',
                {
                  webhookDocs: (
                    <ExternalLink href="https://docs.sentry.io/product/integrations/integration-platform/webhooks/" />
                  ),
                }
              )}
              required={!isInternal}
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('e.g. https://example.com/sentry/webhook/')}
              />
            </field.Layout.Row>
          )}
        </form.AppField>

        {!isInternal && (
          <form.AppField name="redirectUrl">
            {field => (
              <field.Layout.Row
                label={t('Redirect URL')}
                hintText={t('The URL Sentry will redirect users to after installation.')}
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={t('e.g. https://example.com/sentry/setup/')}
                />
              </field.Layout.Row>
            )}
          </form.AppField>
        )}

        {!isInternal && (
          <form.AppField name="verifyInstall">
            {field => (
              <field.Layout.Row
                label={t('Verify Installation')}
                hintText={t(
                  'If enabled, installations will need to be verified before becoming installed.'
                )}
              >
                <field.Switch checked={field.state.value} onChange={field.handleChange} />
              </field.Layout.Row>
            )}
          </form.AppField>
        )}

        <form.AppField name="isAlertable">
          {field => (
            <field.Layout.Row
              label={t('Alert Rule Action')}
              hintText={tct(
                'If enabled, this integration will be available in Issue Alert rules and Metric Alert rules in Sentry. The notification destination is the Webhook URL specified above. More on actions [learnMore:here].',
                {
                  learnMore: (
                    <ExternalLink href="https://docs.sentry.io/product/alerts-notifications/notifications/" />
                  ),
                }
              )}
            >
              <form.Subscribe selector={state => isInternal && !state.values.webhookUrl}>
                {webhookDisabled => (
                  <field.Switch
                    checked={field.state.value}
                    onChange={field.handleChange}
                    disabled={
                      webhookDisabled
                        ? t('Cannot enable alert rule action without a webhook url')
                        : false
                    }
                  />
                )}
              </form.Subscribe>
            </field.Layout.Row>
          )}
        </form.AppField>

        <form.AppField name="schema">
          {field => (
            <field.Layout.Row
              label={t('Schema')}
              hintText={tct(
                'Schema for your UI components. Click [schemaDocs:here] for documentation.',
                {
                  schemaDocs: (
                    <ExternalLink href="https://docs.sentry.io/product/integrations/integration-platform/ui-components/" />
                  ),
                }
              )}
            >
              <field.TextArea
                autosize
                value={field.state.value}
                onChange={field.handleChange}
              />
            </field.Layout.Row>
          )}
        </form.AppField>

        <form.AppField name="overview">
          {field => (
            <field.Layout.Row
              label={t('Overview')}
              hintText={t('Description of your Integration and its functionality.')}
            >
              <field.TextArea
                autosize
                value={field.state.value}
                onChange={field.handleChange}
              />
            </field.Layout.Row>
          )}
        </form.AppField>

        <form.AppField name="allowedOrigins">
          {field => (
            <field.Layout.Row
              label={t('Authorized JavaScript Origins')}
              hintText={t('Separate multiple entries with a newline.')}
            >
              <field.TextArea
                autosize
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('e.g. example.com')}
              />
            </field.Layout.Row>
          )}
        </form.AppField>
      </form.FieldGroup>

      {getAvatarChooser(true)}
      {getAvatarChooser(false)}

      <form.Subscribe selector={state => isInternal && !state.values.webhookUrl}>
        {webhookDisabled => (
          <PermissionsObserver
            webhookDisabled={webhookDisabled}
            appPublished={app ? app.status === 'published' : false}
            scopes={app ? [...app.scopes] : []}
            events={app ? normalize(app.events) : []}
            newApp={!app}
            permissionErrors={scopeErrors.permissions}
            continuousIntegrationError={scopeErrors.continuousIntegration}
            onScopesChange={scopes => form.setFieldValue('scopes', scopes)}
            onEventsChange={events => form.setFieldValue('events', events)}
          />
        )}
      </form.Subscribe>

      {app?.status === 'internal' && (
        <PanelTable
          headers={[
            t('Token'),
            t('Created On'),
            t('Scopes'),
            <AddTokenHeader key="token-add">
              <Button
                size="xs"
                icon={<IconAdd />}
                onClick={onAddToken}
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
                {({id}: {id: string}) => (
                  <TextCopyInput id={id}>{app.clientId ?? ''}</TextCopyInput>
                )}
              </FormField>
            )}
            <FormField
              name="clientSecret"
              label="Client Secret"
              help={t(`Your secret is only available briefly after integration creation. Make
                sure to save this value!`)}
            >
              {({id}: {id: string}) =>
                app.clientSecret ? (
                  <Tooltip
                    disabled={showAuthInfo()}
                    position="right"
                    containerDisplayMode="inline"
                    title={t(
                      'Only Manager or Owner can view these credentials, or the permissions for this integration exceed those of your role.'
                    )}
                  >
                    <TextCopyInput id={id}>{app.clientSecret}</TextCopyInput>
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
                        <Button variant="danger">{t('Rotate client secret')}</Button>
                      </Confirm>
                    ) : undefined}
                  </ClientSecret>
                )
              }
            </FormField>
          </PanelBody>
        </Panel>
      )}

      <Flex justify="end" paddingTop="xl">
        <form.SubmitButton>{t('Save Changes')}</form.SubmitButton>
      </Flex>
    </form.AppForm>
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
  margin: -${p => p.theme.space.md} 0;
  display: flex;
  justify-content: flex-end;
`;
