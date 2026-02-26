import {useCallback} from 'react';
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
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {OrgAuthToken} from 'sentry/types/user';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {
  fetchMutation,
  getApiQueryData,
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {
  makeFetchOrgAuthTokensForOrgQueryKey,
  tokenPreview,
} from 'sentry/views/settings/organizationAuthTokens';

type FetchOrgAuthTokenParameters = {
  orgSlug: string;
  tokenId: string;
};
type FetchOrgAuthTokenResponse = OrgAuthToken;

const makeFetchOrgAuthTokenKey = ({orgSlug, tokenId}: FetchOrgAuthTokenParameters) =>
  [
    getApiUrl(`/organizations/$organizationIdOrSlug/org-auth-tokens/$tokenId/`, {
      path: {organizationIdOrSlug: orgSlug, tokenId},
    }),
  ] as const;

const schema = z.object({
  name: z.string().min(1, t('Name is required')),
});

function AuthTokenDetailsForm({token}: {token: OrgAuthToken}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleGoBack = useCallback(
    () => navigate(`/settings/${organization.slug}/auth-tokens/`),
    [navigate, organization.slug]
  );

  const mutation = useMutation<unknown, RequestError, z.infer<typeof schema>>({
    mutationFn: data =>
      fetchMutation({
        url: `/organizations/${organization.slug}/org-auth-tokens/${token.id}/`,
        method: 'PUT',
        data,
      }),

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

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {name: token.name},
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
          label={t('Token')}
          help={t('You can only view the token once after creation.')}
        >
          <div>{tokenPreview(token.tokenLastCharacters || '****')}</div>
        </FieldGroup>

        <FieldGroup
          label={t('Scopes')}
          help={t('You cannot change the scopes of an existing token.')}
        >
          <div>{token.scopes.slice().sort().join(', ')}</div>
        </FieldGroup>

        <Flex justify="end" gap="md" padding="md">
          <Button onClick={handleGoBack}>{t('Cancel')}</Button>
          <form.SubmitButton>{t('Save Changes')}</form.SubmitButton>
        </Flex>
      </form.FormWrapper>
    </form.AppForm>
  );
}

function OrganizationAuthTokensDetails() {
  const organization = useOrganization();
  const {tokenId} = useParams<{tokenId: string}>();

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
      <SentryDocumentTitle title={t('Edit Organization Token')} />
      <SettingsPageHeader title={t('Edit Organization Token')} />

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
        <PanelHeader>{t('Organization Token Details')}</PanelHeader>

        <PanelBody>
          {isError && (
            <LoadingError
              message={t('Failed to load organization token.')}
              onRetry={refetchToken}
            />
          )}

          {isPending && <LoadingIndicator />}

          {!isPending && !isError && token && <AuthTokenDetailsForm token={token} />}
        </PanelBody>
      </Panel>
    </div>
  );
}

export default OrganizationAuthTokensDetails;
