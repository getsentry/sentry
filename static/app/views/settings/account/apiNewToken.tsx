import {useCallback, useState} from 'react';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {FieldGroup} from 'sentry/components/forms/fieldGroup';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {
  DISTRIBUTION_SENTRY_APP_PERMISSION,
  SENTRY_APP_PERMISSIONS,
} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import type {Permissions} from 'sentry/types/integrations';
import type {NewInternalAppApiToken} from 'sentry/types/user';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {fetchMutation, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {displayNewToken} from 'sentry/views/settings/components/newTokenHandler';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {TextBlock} from 'sentry/views/settings/components/text/textBlock';
import PermissionSelection, {
  permissionStateToList,
} from 'sentry/views/settings/organizationDeveloperSettings/permissionSelection';

const API_INDEX_ROUTE = '/settings/account/api/auth-tokens/';

const schema = z.object({
  name: z.string().optional(),
});

const INITIAL_PERMISSIONS: Permissions = {
  Event: 'no-access',
  Team: 'no-access',
  Member: 'no-access',
  Project: 'no-access',
  Release: 'no-access',
  Organization: 'no-access',
  Alerts: 'no-access',
  Distribution: 'no-access',
};

// Personal tokens can't be used for Distribution. The point of
// Distribution is to embed the token into an app. We don't want people
// using personal tokens for that.
const DISPLAYED_PERMISSIONS = SENTRY_APP_PERMISSIONS.filter(
  o => o !== DISTRIBUTION_SENTRY_APP_PERMISSION
);

function getPermissionsPreview(permissions: Permissions): string {
  return Object.entries(permissions)
    .filter(([, access]) => access !== 'no-access')
    .map(([resource, access]) => `${resource.toLowerCase()}:${access}`)
    .join('\n');
}

export default function ApiNewToken() {
  const [permissions, setPermissions] = useState<Permissions>({...INITIAL_PERMISSIONS});
  const [hasNewToken, setHasNewToken] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleGoBack = useCallback(
    () => navigate(normalizeUrl(API_INDEX_ROUTE)),
    [navigate]
  );

  const allPermissionsNoAccess = Object.values(permissions).every(
    value => value === 'no-access'
  );

  const mutation = useMutation<
    NewInternalAppApiToken,
    RequestError,
    z.infer<typeof schema>
  >({
    mutationFn: data =>
      fetchMutation<NewInternalAppApiToken>({
        url: '/api-tokens/',
        method: 'POST',
        data: {
          ...data,
          scopes: permissionStateToList(permissions).filter(Boolean) as string[],
        },
      }),
    onSuccess: token => {
      addSuccessMessage(t('Created personal token.'));
      queryClient.invalidateQueries({queryKey: [getApiUrl('/api-tokens/')]});
      setHasNewToken(true);
      displayNewToken(token.token, handleGoBack);
    },
    onError: error => {
      const message = t('Failed to create a new personal token.');
      handleXhrErrorResponse(message, error);
      addErrorMessage(message);
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {name: ''},
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      addLoadingMessage();
      return mutation.mutateAsync(value).catch(() => {});
    },
  });

  const permissionsPreview = getPermissionsPreview(permissions);

  return (
    <SentryDocumentTitle title={t('Create New Personal Token')}>
      <div>
        <SettingsPageHeader title={t('Create New Personal Token')} />
        <TextBlock>
          {t(
            "Personal tokens allow you to perform actions against the Sentry API on behalf of your account. They're the easiest way to get started using the API."
          )}
        </TextBlock>
        <TextBlock>
          {tct(
            'For more information on how to use the web API, see our [link:documentation].',
            {
              link: <ExternalLink href="https://docs.sentry.io/api/" />,
            }
          )}
        </TextBlock>
        <form.AppForm form={form}>
          <Panel>
            <PanelHeader>{t('General')}</PanelHeader>
            <PanelBody>
              <form.AppField name="name">
                {field => (
                  <field.Layout.Row
                    label={t('Name')}
                    hintText={t('A name to help you identify this token.')}
                  >
                    <field.Input
                      value={field.state.value}
                      onChange={field.handleChange}
                    />
                  </field.Layout.Row>
                )}
              </form.AppField>
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader>{t('Permissions')}</PanelHeader>
            <PanelBody>
              <PermissionSelection
                appPublished={false}
                permissions={permissions}
                onChange={p => setPermissions({...p})}
                displayedPermissions={DISPLAYED_PERMISSIONS}
              />
            </PanelBody>
            <FieldGroup
              label={t('Permissions Preview')}
              help={t('Your token will have the following scopes.')}
            >
              <div>{permissionsPreview || '—'}</div>
            </FieldGroup>
          </Panel>
          <Flex justify="end" gap="md" padding="md">
            <Button onClick={handleGoBack}>{t('Cancel')}</Button>
            <form.SubmitButton disabled={hasNewToken || allPermissionsNoAccess}>
              {t('Create Token')}
            </form.SubmitButton>
          </Flex>
        </form.AppForm>
      </div>
    </SentryDocumentTitle>
  );
}
