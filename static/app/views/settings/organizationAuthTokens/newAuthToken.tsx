import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {OrgAuthToken} from 'sentry/types/user';
import getDynamicText from 'sentry/utils/getDynamicText';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import withOrganization from 'sentry/utils/withOrganization';
import NewTokenHandler from 'sentry/views/settings/components/newTokenHandler';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {makeFetchOrgAuthTokensForOrgQueryKey} from 'sentry/views/settings/organizationAuthTokens';

type CreateTokenQueryVariables = {
  name: string;
};

type OrgAuthTokenWithToken = OrgAuthToken & {token: string};

type CreateOrgAuthTokensResponse = OrgAuthTokenWithToken;

function AuthTokenCreateForm({
  organization,
  onCreatedToken,
}: {
  onCreatedToken: (token: OrgAuthTokenWithToken) => void;
  organization: Organization;
}) {
  const initialData = {
    name: '',
  };

  const navigate = useNavigate();
  const api = useApi();
  const queryClient = useQueryClient();

  const handleGoBack = useCallback(
    () => navigate(`/settings/${organization.slug}/auth-tokens/`),
    [navigate, organization.slug]
  );

  const {mutate: submitToken} = useMutation<
    CreateOrgAuthTokensResponse,
    RequestError,
    CreateTokenQueryVariables
  >({
    mutationFn: ({name}) => {
      addLoadingMessage();
      return api.requestPromise(`/organizations/${organization.slug}/org-auth-tokens/`, {
        method: 'POST',
        data: {
          name,
        },
      });
    },

    onSuccess: (token: OrgAuthTokenWithToken) => {
      addSuccessMessage(t('Created auth token.'));

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
          : t('Failed to create a new auth token.');
      handleXhrErrorResponse(message, error);
      addErrorMessage(message);
    },
  });

  return (
    <Form
      apiMethod="POST"
      initialData={initialData}
      apiEndpoint={`/organizations/${organization.slug}/org-auth-tokens/`}
      onSubmit={({name}) => {
        submitToken({
          name,
        });
      }}
      onCancel={handleGoBack}
      submitLabel={t('Create Auth Token')}
      requireChanges
    >
      <TextField
        name="name"
        label={t('Name')}
        required
        help={t('A name to help you identify this token.')}
      />

      <FieldGroup
        label={t('Scopes')}
        help={t('Organization auth tokens currently have a limited set of scopes.')}
      >
        <div>
          <div>org:ci</div>
          <ScopeHelpText>{t('Source Map Upload, Release Creation')}</ScopeHelpText>
        </div>
      </FieldGroup>
    </Form>
  );
}

export function OrganizationAuthTokensNewAuthToken({
  organization,
}: {
  organization: Organization;
}) {
  const navigate = useNavigate();
  const [newToken, setNewToken] = useState<OrgAuthTokenWithToken | null>(null);

  const handleGoBack = useCallback(
    () => navigate(`/settings/${organization.slug}/auth-tokens/`),
    [navigate, organization.slug]
  );

  return (
    <div>
      <SentryDocumentTitle title={t('Create New Auth Token')} />
      <SettingsPageHeader title={t('Create New Auth Token')} />

      <TextBlock>
        {t(
          'Organization Auth Tokens can be used in many places to interact with Sentry programatically. For example, they can be used for sentry-cli, bundler plugins or similar uses cases.'
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
        <PanelHeader>{t('Create New Auth Token')}</PanelHeader>

        <PanelBody>
          {newToken ? (
            <NewTokenHandler
              token={getDynamicText({value: newToken.token, fixed: 'ORG_AUTH_TOKEN'})}
              handleGoBack={handleGoBack}
            />
          ) : (
            <AuthTokenCreateForm
              organization={organization}
              onCreatedToken={setNewToken}
            />
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}

export default withOrganization(OrganizationAuthTokensNewAuthToken);

const ScopeHelpText = styled('div')`
  color: ${p => p.theme.gray300};
`;
