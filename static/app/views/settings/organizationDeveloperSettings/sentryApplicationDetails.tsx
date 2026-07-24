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
} from 'sentry/types/integrations';
import type {InternalAppApiToken, NewInternalAppApiToken} from 'sentry/types/user';
import {convertMultilineFieldValue, extractMultilineFields} from 'sentry/utils';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation, setApiQueryData, useApiQuery} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {ApiTokenRow} from 'sentry/views/settings/account/apiTokenRow';
import {displayNewToken} from 'sentry/views/settings/components/newTokenHandler';
import {BreadcrumbTitle} from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';
import type {WebhookSubscription} from 'sentry/views/settings/organizationDeveloperSettings/constants';
import {
  EVENT_CHOICES,
  granularWebhookEvents,
  WEBHOOK_GRANULAR_EVENT_CHOICES,
} from 'sentry/views/settings/organizationDeveloperSettings/constants';
import {PermissionsObserver} from 'sentry/views/settings/organizationDeveloperSettings/permissionsObserver';
import {
  AllowedOriginsField,
  AlertableField,
  AuthorField,
  NameField,
  OverviewField,
  RedirectUrlField,
  SchemaField,
  VerifyInstallField,
  WebhookHeadersField,
  WebhookUrlField,
} from 'sentry/views/settings/organizationDeveloperSettings/sentryAppFormFields';

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

const sentryAppBaseSchema = z.object({
  name: z.string(),
  author: z.string(),
  webhookUrl: z.string(),
  webhookHeaders: z.string(),
  redirectUrl: z.string(),
  verifyInstall: z.boolean(),
  isAlertable: z.boolean(),
  schema: z.string(),
  overview: z.string(),
  allowedOrigins: z.string(),
  organization: z.string(),
  isInternal: z.boolean(),
  scopes: z.array(z.enum(ALLOWED_SCOPES)),
  events: z.array(
    z.union([z.enum(EVENT_CHOICES), z.enum(WEBHOOK_GRANULAR_EVENT_CHOICES)])
  ),
});

type SentryAppFormValues = z.infer<typeof sentryAppBaseSchema>;

function requireField(ctx: z.RefinementCtx, value: string, field: string) {
  if (!value.trim()) {
    ctx.addIssue({
      code: 'custom',
      message: t('This field is required'),
      path: [field],
    });
  }
}

// Mirrors the backend's events-require-a-webhook-URL rule.
function requireWebhookUrlForEvents(ctx: z.RefinementCtx, data: SentryAppFormValues) {
  if (!data.webhookUrl.trim() && data.events.length > 0) {
    ctx.addIssue({
      code: 'custom',
      message: t('This field is required when webhook events are enabled'),
      path: ['webhookUrl'],
    });
  }
}

function requireValidSchemaJson(ctx: z.RefinementCtx, data: SentryAppFormValues) {
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
}

const internalSentryAppSchema = sentryAppBaseSchema.superRefine((data, ctx) => {
  requireField(ctx, data.name, 'name');
  requireWebhookUrlForEvents(ctx, data);
  requireValidSchemaJson(ctx, data);
});

const publicSentryAppSchema = sentryAppBaseSchema.superRefine((data, ctx) => {
  requireField(ctx, data.name, 'name');
  requireField(ctx, data.author, 'author');
  requireField(ctx, data.webhookUrl, 'webhookUrl');
  requireValidSchemaJson(ctx, data);
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
    if (typeof message !== 'string') {
      continue;
    }
    const match = message.match(/Requested permission of (\w+:\w+)/);
    if (!match) {
      continue;
    }
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
  webhookHeaders?: string[];
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

function buildSentryAppPayload(value: SentryAppFormValues): SaveSentryAppPayload {
  return {
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
    webhookHeaders: extractMultilineFields(value.webhookHeaders),
    schema: value.schema.trim() === '' ? {} : JSON.parse(value.schema),
    // The author parser doesn't allow_blank, so send null for empty
    // (covers internal apps with no author).
    author: value.author || null,
  };
}

function emptySentryAppValues(
  organizationSlug: string,
  isInternal: boolean
): SentryAppFormValues {
  return {
    name: '',
    author: '',
    webhookUrl: '',
    webhookHeaders: '',
    redirectUrl: '',
    verifyInstall: !isInternal,
    isAlertable: false,
    schema: '',
    overview: '',
    allowedOrigins: '',
    organization: organizationSlug,
    isInternal,
    scopes: [],
    events: [],
  };
}

function useSaveSentryApp({
  app,
  isInternal,
}: {
  app: SentryApp | undefined;
  isInternal: boolean;
}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [scopeErrors, setScopeErrors] = useState<ScopeErrors>({permissions: {}});

  const handleSaveError = (
    error: unknown,
    formApi: Parameters<typeof setFieldErrors>[0]
  ) => {
    if (!(error instanceof RequestError)) {
      addErrorMessage(t('Unknown Error'));
      return;
    }
    const responseJSON = error.responseJSON ?? {};

    const mappedScopeErrors = mapScopeErrors(responseJSON.scopes);
    setScopeErrors(mappedScopeErrors);
    const hadScopeErrors =
      Object.keys(mappedScopeErrors.permissions).length > 0 ||
      mappedScopeErrors.continuousIntegration !== undefined;

    // setFieldErrors targets the scopes/events fields too, but nothing renders
    // them inline — the toasts below cover what the form can't show.
    const fieldErrorsApplied = setFieldErrors(formApi, error);

    if (
      Array.isArray(responseJSON.events) &&
      typeof responseJSON.events[0] === 'string'
    ) {
      addErrorMessage(responseJSON.events[0]);
      return;
    }

    // Unmapped scope errors have no inline UI — surface the first one as a toast.
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
      typeof responseJSON.detail === 'string' ? responseJSON.detail : t('Unknown Error');
    addErrorMessage(detail);
  };

  const saveSentryAppMutation = useMutation({
    mutationFn: (data: SaveSentryAppPayload) =>
      fetchMutation<SentryApp>({
        url: app ? `/sentry-apps/${app.slug}/` : '/sentry-apps/',
        method: app ? 'PUT' : 'POST',
        data,
      }),
    onMutate: () => setScopeErrors({permissions: {}}),
    onSuccess: data => {
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

        queryClient.invalidateQueries({
          queryKey: sentryAppApiOptions({appSlug: app.slug}).queryKey,
        });
      } else {
        addSuccessMessage(t('%s successfully created.', data.name));
      }

      navigate(normalizeUrl(url));
    },
  });

  return {handleSaveError, saveSentryAppMutation, scopeErrors};
}

export default function SentryApplicationDetails() {
  const location = useLocation();
  const {appSlug} = useParams<{appSlug: string}>();
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const isInternalRoute = location.pathname.endsWith('new-internal/');
  const isPublicRoute = location.pathname.endsWith('new-public/');

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

  return (
    <div>
      <BreadcrumbTitle title={appSlug ? (app?.name ?? '') : t('New')} />

      {isLoading || isPlaceholderData ? (
        <LoadingIndicator />
      ) : isError ? (
        <LoadingError onRetry={refetch} />
      ) : isInternalRoute ? (
        <InternalSentryAppCreationForm />
      ) : isPublicRoute ? (
        <PublicSentryAppCreationForm />
      ) : app ? (
        <SentryAppEditForm app={app} tokens={tokens} />
      ) : (
        <LoadingError onRetry={refetch} />
      )}
    </div>
  );
}

function InternalSentryAppCreationForm() {
  const organization = useOrganization();
  const {handleSaveError, saveSentryAppMutation, scopeErrors} = useSaveSentryApp({
    app: undefined,
    isInternal: true,
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: emptySentryAppValues(organization.slug, true),
    validators: {
      onDynamic: internalSentryAppSchema,
    },
    onSubmit: ({value, formApi}) =>
      saveSentryAppMutation
        .mutateAsync(buildSentryAppPayload(value))
        .catch(error => handleSaveError(error, formApi)),
  });

  return (
    <form.AppForm form={form}>
      <form.FieldGroup title={t('Internal Integration Details')}>
        <NameField form={form} fields={{name: 'name'}} />

        <WebhookUrlField
          form={form}
          fields={{webhookUrl: 'webhookUrl'}}
          onValueChange={value => {
            if (!value && form.getFieldValue('isAlertable')) {
              form.setFieldValue('isAlertable', false);
            }
          }}
        />

        <WebhookHeadersField form={form} fields={{webhookHeaders: 'webhookHeaders'}} />

        <AlertableField
          form={form}
          fields={{isAlertable: 'isAlertable', webhookUrl: 'webhookUrl'}}
          requireWebhookUrl
        />

        <SchemaField form={form} fields={{schema: 'schema'}} />

        <OverviewField form={form} fields={{overview: 'overview'}} />

        <AllowedOriginsField form={form} fields={{allowedOrigins: 'allowedOrigins'}} />
      </form.FieldGroup>

      <PermissionsObserver
        appPublished={false}
        scopes={[]}
        events={[]}
        newApp
        permissionErrors={scopeErrors.permissions}
        continuousIntegrationError={scopeErrors.continuousIntegration}
        onScopesChange={scopes => form.setFieldValue('scopes', scopes)}
        onEventsChange={events => form.setFieldValue('events', events)}
      />

      <Flex justify="end" paddingTop="xl">
        <form.SubmitButton>{t('Save Changes')}</form.SubmitButton>
      </Flex>
    </form.AppForm>
  );
}

function PublicSentryAppCreationForm() {
  const organization = useOrganization();
  const {handleSaveError, saveSentryAppMutation, scopeErrors} = useSaveSentryApp({
    app: undefined,
    isInternal: false,
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: emptySentryAppValues(organization.slug, false),
    validators: {
      onDynamic: publicSentryAppSchema,
    },
    onSubmit: ({value, formApi}) =>
      saveSentryAppMutation
        .mutateAsync(buildSentryAppPayload(value))
        .catch(error => handleSaveError(error, formApi)),
  });

  return (
    <form.AppForm form={form}>
      <form.FieldGroup title={t('Public Integration Details')}>
        <NameField form={form} fields={{name: 'name'}} />

        <AuthorField form={form} fields={{author: 'author'}} />

        <WebhookUrlField form={form} fields={{webhookUrl: 'webhookUrl'}} required />

        <WebhookHeadersField form={form} fields={{webhookHeaders: 'webhookHeaders'}} />

        <RedirectUrlField form={form} fields={{redirectUrl: 'redirectUrl'}} />

        <VerifyInstallField form={form} fields={{verifyInstall: 'verifyInstall'}} />

        <AlertableField
          form={form}
          fields={{isAlertable: 'isAlertable', webhookUrl: 'webhookUrl'}}
        />

        <SchemaField form={form} fields={{schema: 'schema'}} />

        <OverviewField form={form} fields={{overview: 'overview'}} />

        <AllowedOriginsField form={form} fields={{allowedOrigins: 'allowedOrigins'}} />
      </form.FieldGroup>

      <PermissionsObserver
        appPublished={false}
        scopes={[]}
        events={[]}
        newApp
        permissionErrors={scopeErrors.permissions}
        continuousIntegrationError={scopeErrors.continuousIntegration}
        onScopesChange={scopes => form.setFieldValue('scopes', scopes)}
        onEventsChange={events => form.setFieldValue('events', events)}
      />

      <Flex justify="end" paddingTop="xl">
        <form.SubmitButton>{t('Save Changes')}</form.SubmitButton>
      </Flex>
    </form.AppForm>
  );
}

function SentryAppEditForm({
  app,
  tokens,
}: {
  app: SentryApp;
  tokens: InternalAppApiToken[];
}) {
  const {openModal} = useModal();
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const isInternal = app.status === 'internal';
  const sentryAppQueryOptions = sentryAppApiOptions({appSlug: app.slug});

  const [newTokens, setNewTokens] = useState<NewInternalAppApiToken[]>([]);
  const {handleSaveError, saveSentryAppMutation, scopeErrors} = useSaveSentryApp({
    app,
    isInternal,
  });

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

  // Older API responses only send the consolidated resource list
  const initialEvents: WebhookSubscription[] = granularWebhookEvents(
    app.webhookEvents ?? app.events
  );

  const hasTokenAccess = () => {
    return organization.access.includes('org:write');
  };

  const showAuthInfo = () => !(app.clientSecret?.[0] === '*');

  const onAddToken = async (event: MouseEvent<HTMLButtonElement>): Promise<void> => {
    event.preventDefault();
    const token = await addTokenMutation.mutateAsync(app.slug);
    const updatedNewTokens = newTokens.concat(token);
    setNewTokens(updatedNewTokens);
    displayNewToken(token.token, () => handleFinishNewToken(token));
  };

  const handleFinishNewToken = (newToken: NewInternalAppApiToken) => {
    const updatedNewTokens = newTokens.filter(token => token.id !== newToken.id);
    const updatedTokens = tokens.concat(newToken);
    setApiQueryData(queryClient, makeSentryAppApiTokensQueryKey(app.slug), updatedTokens);
    setNewTokens(updatedNewTokens);
  };

  const onRemoveToken = async (token: InternalAppApiToken) => {
    const updatedTokens = tokens.filter(tok => tok.id !== token.id);
    await removeTokenMutation.mutateAsync({sentryAppSlug: app.slug, tokenId: token.id});
    setApiQueryData(queryClient, makeSentryAppApiTokensQueryKey(app.slug), updatedTokens);
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
    if (avatar) {
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
    name: app.name,
    author: app.author ?? '',
    webhookUrl: app.webhookUrl ?? '',
    redirectUrl: app.redirectUrl ?? '',
    verifyInstall: isInternal ? false : app.verifyInstall,
    isAlertable: app.isAlertable,
    schema: getSchemaFieldValue(app.schema),
    overview: app.overview ?? '',
    allowedOrigins: convertMultilineFieldValue(app.allowedOrigins ?? []),
    // Masked values (Header-Name: ***) round-trip safely: the backend preserves
    // the stored value for any entry resubmitted with the mask sentinel.
    webhookHeaders: convertMultilineFieldValue(app.webhookHeaders ?? []),
    organization: organization.slug,
    isInternal,
    scopes: [...app.scopes],
    events: initialEvents,
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {
      onDynamic: isInternal ? internalSentryAppSchema : publicSentryAppSchema,
    },
    onSubmit: ({value, formApi}) =>
      saveSentryAppMutation
        .mutateAsync(buildSentryAppPayload(value))
        .catch(error => handleSaveError(error, formApi)),
  });

  return (
    <form.AppForm form={form}>
      <form.FieldGroup
        title={
          isInternal ? t('Internal Integration Details') : t('Public Integration Details')
        }
      >
        <NameField form={form} fields={{name: 'name'}} />

        {!isInternal && <AuthorField form={form} fields={{author: 'author'}} />}

        <WebhookUrlField
          form={form}
          fields={{webhookUrl: 'webhookUrl'}}
          required={!isInternal}
          onValueChange={value => {
            if (isInternal && !value && form.getFieldValue('isAlertable')) {
              form.setFieldValue('isAlertable', false);
            }
          }}
        />

        <WebhookHeadersField form={form} fields={{webhookHeaders: 'webhookHeaders'}} />

        {!isInternal && (
          <RedirectUrlField form={form} fields={{redirectUrl: 'redirectUrl'}} />
        )}

        {!isInternal && (
          <VerifyInstallField form={form} fields={{verifyInstall: 'verifyInstall'}} />
        )}

        <AlertableField
          form={form}
          fields={{isAlertable: 'isAlertable', webhookUrl: 'webhookUrl'}}
          requireWebhookUrl={isInternal}
        />

        <SchemaField form={form} fields={{schema: 'schema'}} />

        <OverviewField form={form} fields={{overview: 'overview'}} />

        <AllowedOriginsField form={form} fields={{allowedOrigins: 'allowedOrigins'}} />
      </form.FieldGroup>

      {getAvatarChooser(true)}
      {getAvatarChooser(false)}

      <PermissionsObserver
        appPublished={app.status === 'published'}
        scopes={[...app.scopes]}
        events={initialEvents}
        newApp={false}
        permissionErrors={scopeErrors.permissions}
        continuousIntegrationError={scopeErrors.continuousIntegration}
        onScopesChange={scopes => form.setFieldValue('scopes', scopes)}
        onEventsChange={events => form.setFieldValue('events', events)}
      />

      {isInternal && (
        <PanelTable
          headers={[
            t('Token'),
            t('Created On'),
            t('Scopes'),
            <AddTokenHeader key="token-add">
              <Tooltip
                disabled={hasTokenAccess()}
                title={t(
                  'You must be a Manager or Owner to create authentication tokens.'
                )}
              >
                <Button
                  size="xs"
                  icon={<IconAdd />}
                  onClick={onAddToken}
                  disabled={!hasTokenAccess()}
                  data-test-id="token-add"
                >
                  {t('New Token')}
                </Button>
              </Tooltip>
            </AddTokenHeader>,
          ]}
          isEmpty={tokens.length === 0}
          emptyMessage={t("You haven't created any authentication tokens yet.")}
        >
          {renderTokens()}
        </PanelTable>
      )}

      <Panel>
        <PanelHeader>{t('Credentials')}</PanelHeader>
        <PanelBody>
          {!isInternal && (
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
