import {useCallback} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {OrgAuthToken} from 'sentry/types/user';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {
  getApiQueryData,
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {
  makeFetchOrgAuthTokensForOrgQueryKey,
  tokenPreview,
} from 'sentry/views/settings/organizationAuthTokens';

type Props = {
  organization: Organization;
  params: {tokenId: string};
};

type FetchOrgAuthTokenParameters = {
  orgSlug: string;
  tokenId: string;
};
type FetchOrgAuthTokenResponse = OrgAuthToken;
type UpdateTokenQueryVariables = {
  name: string;
};

export const makeFetchOrgAuthTokenKey = ({
  orgSlug,
  tokenId,
}: FetchOrgAuthTokenParameters) =>
  [`/organizations/${orgSlug}/org-auth-tokens/${tokenId}/`] as const;

function AuthTokenDetailsForm({
  token,
  organization,
}: {
  organization: Organization;
  token: OrgAuthToken;
}) {
  const initialData = {
    name: token.name,
    tokenPreview: tokenPreview(token.tokenLastCharacters || '****'),
  };

  const navigate = useNavigate();
  const api = useApi();
  const queryClient = useQueryClient();

  const handleGoBack = useCallback(
    () => navigate(`/settings/${organization.slug}/auth-tokens/`),
    [navigate, organization.slug]
  );

  const {mutate: submitToken} = useMutation<{}, RequestError, UpdateTokenQueryVariables>({
    mutationFn: ({name}) =>
      api.requestPromise(
        `/organizations/${organization.slug}/org-auth-tokens/${token.id}/`,
        {
          method: 'PUT',
          data: {
            name,
          },
        }
      ),

    onSuccess: (_data, {name}) => {
      addSuccessMessage(t('Updated auth token.'));

      // Update get by id query
      setApiQueryData(
        queryClient,
        makeFetchOrgAuthTokenKey({orgSlug: organization.slug, tokenId: token.id}),
        (oldData: OrgAuthToken | undefined) => {
          if (!oldData) {
            return oldData;
          }

          oldData.name = name;

          return oldData;
        }
      );

      // Update get list query
      if (
        getApiQueryData(
          queryClient,
          makeFetchOrgAuthTokensForOrgQueryKey({orgSlug: organization.slug})
        )
      ) {
        setApiQueryData(
          queryClient,
          makeFetchOrgAuthTokensForOrgQueryKey({orgSlug: organization.slug}),
          (oldData: OrgAuthToken[] | undefined) => {
            if (!Array.isArray(oldData)) {
              return oldData;
            }

            const existingToken = oldData.find(oldToken => oldToken.id === token.id);

            if (existingToken) {
              existingToken.name = name;
            }

            return oldData;
          }
        );
      }

      handleGoBack();
    },
    onError: error => {
      const message = t('Failed to update the auth token.');
      handleXhrErrorResponse(message, error);
      addErrorMessage(message);
    },
  });

  return (
    <Form
      apiMethod="PUT"
      initialData={initialData}
      apiEndpoint={`/organizations/${organization.slug}/org-auth-tokens/${token.id}/`}
      onSubmit={({name}) => {
        addLoadingMessage();

        return submitToken({
          name,
        });
      }}
      onCancel={handleGoBack}
    >
      <TextField
        name="name"
        label={t('Name')}
        required
        help={t('A name to help you identify this token.')}
      />

      <TextField
        name="tokenPreview"
        label={t('Token')}
        disabled
        help={t('You can only view the token once after creation.')}
      />

      <FieldGroup
        label={t('Scopes')}
        help={t('You cannot change the scopes of an existing token.')}
      >
        <div>{token.scopes.slice().sort().join(', ')}</div>
      </FieldGroup>
    </Form>
  );
}

export function OrganizationAuthTokensDetails({params, organization}: Props) {
  const {tokenId} = params;

  const {
    isPending,
    isError,
    data: token,
    refetch: refetchToken,
  } = useApiQuery<FetchOrgAuthTokenResponse>(
    makeFetchOrgAuthTokenKey({orgSlug: organization.slug, tokenId}),
    {
      staleTime: Infinity,
    }
  );

  return (
    <div>
      <SentryDocumentTitle title={t('Edit Auth Token')} />
      <SettingsPageHeader title={t('Edit Auth Token')} />

      <TextBlock>
        {t(
          "Authentication tokens allow you to perform actions against the Sentry API on behalf of your organization. They're the easiest way to get started using the API."
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
        <PanelHeader>{t('Auth Token Details')}</PanelHeader>

        <PanelBody>
          {isError && (
            <LoadingError
              message={t('Failed to load auth token.')}
              onRetry={refetchToken}
            />
          )}

          {isPending && <LoadingIndicator />}

          {!isPending && !isError && token && (
            <AuthTokenDetailsForm token={token} organization={organization} />
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}

export default withOrganization(OrganizationAuthTokensDetails);
