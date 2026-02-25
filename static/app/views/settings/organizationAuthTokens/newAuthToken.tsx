import {useCallback} from 'react';
import styled from '@emotion/styled';
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
import FieldGroup from 'sentry/components/forms/fieldGroup';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {OrgAuthToken} from 'sentry/types/user';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {fetchMutation, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {displayNewToken} from 'sentry/views/settings/components/newTokenHandler';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {makeFetchOrgAuthTokensForOrgQueryKey} from 'sentry/views/settings/organizationAuthTokens';

type OrgAuthTokenWithToken = OrgAuthToken & {token: string};

const schema = z.object({
  name: z.string().min(1, t('Name is required')),
});

function AuthTokenCreateForm({
  organization,
  onCreatedToken,
}: {
  onCreatedToken: (token: OrgAuthTokenWithToken) => void;
  organization: Organization;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleGoBack = useCallback(
    () => navigate(`/settings/${organization.slug}/auth-tokens/`),
    [navigate, organization.slug]
  );

  const mutation = useMutation<
    OrgAuthTokenWithToken,
    RequestError,
    z.infer<typeof schema>
  >({
    mutationFn: data =>
      fetchMutation<OrgAuthTokenWithToken>({
        url: `/organizations/${organization.slug}/org-auth-tokens/`,
        method: 'POST',
        data,
      }),
    onSuccess: (token: OrgAuthTokenWithToken) => {
      addSuccessMessage(t('Created organization token.'));

      queryClient.invalidateQueries({
        queryKey: makeFetchOrgAuthTokensForOrgQueryKey({orgSlug: organization.slug}),
      });

      onCreatedToken(token);
    },
    onError: error => {
      const detail = error.responseJSON?.detail;
      const code = detail && typeof detail === 'object' ? detail.code : undefined;

      const message =
        code === 'missing_system_url_prefix'
          ? t(
              'You have to configure `system.url-prefix` in your Sentry instance in order to generate tokens.'
            )
          : t('Failed to create a new organization token.');
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

  return (
    <form.AppForm>
      <form.FormWrapper>
        <form.AppField name="name">
          {field => (
            <field.Layout.Row
              label={t('Name')}
              hintText={t('A name to help you identify this token.')}
              required
            >
              <field.Input value={field.state.value} onChange={field.handleChange} />
            </field.Layout.Row>
          )}
        </form.AppField>

        <FieldGroup
          label={t('Scopes')}
          help={t('Organization tokens currently have a limited set of scopes.')}
        >
          <div>
            <div>org:ci</div>
            <ScopeHelpText>{t('Source Map Upload, Release Creation')}</ScopeHelpText>
          </div>
        </FieldGroup>

        <Flex justify="end" gap="md" padding="md">
          <Button onClick={handleGoBack}>{t('Cancel')}</Button>
          <form.SubmitButton>{t('Create Token')}</form.SubmitButton>
        </Flex>
      </form.FormWrapper>
    </form.AppForm>
  );
}

export default function OrganizationAuthTokensNewAuthToken() {
  const organization = useOrganization();
  const navigate = useNavigate();

  const handleGoBack = useCallback(
    () => navigate(`/settings/${organization.slug}/auth-tokens/`),
    [navigate, organization.slug]
  );

  return (
    <div>
      <SentryDocumentTitle title={t('Create New Organization Token')} />
      <SettingsPageHeader title={t('Create New Organization Token')} />

      <TextBlock>
        {t(
          'Organization tokens can be used in many places to interact with Sentry programmatically. For example, they can be used for sentry-cli, bundler plugins or similar uses cases.'
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
      <Panel>
        <PanelHeader>{t('Create New Organization Token')}</PanelHeader>

        <PanelBody>
          <AuthTokenCreateForm
            organization={organization}
            onCreatedToken={token => displayNewToken(token.token, handleGoBack)}
          />
        </PanelBody>
      </Panel>
    </div>
  );
}

const ScopeHelpText = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
`;
