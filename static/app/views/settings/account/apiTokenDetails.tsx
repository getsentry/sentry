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
import type {InternalAppApiToken} from 'sentry/types/user';
import {browserHistory} from 'sentry/utils/browserHistory';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {useApiQuery} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useMutateApiToken from 'sentry/utils/useMutateApiToken';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {tokenPreview} from 'sentry/views/settings/organizationAuthTokens';

const API_INDEX_ROUTE = '/settings/account/api/auth-tokens/';

type Props = {
  params: {tokenId: string};
};

type FetchApiTokenParameters = {
  tokenId: string;
};
type FetchApiTokenResponse = InternalAppApiToken;

export const makeFetchApiTokenKey = ({tokenId}: FetchApiTokenParameters) =>
  [`/api-tokens/${tokenId}/`] as const;

function ApiTokenDetailsForm({token}: {token: InternalAppApiToken}) {
  const initialData = {
    name: token.name,
    tokenPreview: tokenPreview(token.tokenLastCharacters || '****'),
  };

  const handleGoBack = () => {
    browserHistory.push(normalizeUrl(API_INDEX_ROUTE));
  };

  const onSuccess = () => {
    addSuccessMessage(t('Updated user auth token.'));
    handleGoBack();
  };

  const onError = error => {
    const message = t('Failed to update the user auth token.');
    handleXhrErrorResponse(message, error);
    addErrorMessage(message);
  };

  const {mutate: submitToken} = useMutateApiToken({
    token,
    onSuccess,
    onError,
  });

  return (
    <Form
      apiMethod="PUT"
      initialData={initialData}
      apiEndpoint={`/api-tokens/${token.id}/`}
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

export function ApiTokenDetails({params}: Props) {
  const {tokenId} = params;

  const {
    isPending,
    isError,
    data: token,
    refetch: refetchToken,
  } = useApiQuery<FetchApiTokenResponse>(makeFetchApiTokenKey({tokenId}), {
    staleTime: Infinity,
  });

  return (
    <div>
      <SentryDocumentTitle title={t('Edit User Auth Token')} />
      <SettingsPageHeader title={t('Edit User Auth Token')} />

      <TextBlock>
        {t(
          "Authentication tokens allow you to perform actions against the Sentry API on behalf of your account. They're the easiest way to get started using the API."
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
        <PanelHeader>{t('User Auth Token Details')}</PanelHeader>

        <PanelBody>
          {isError && (
            <LoadingError
              message={t('Failed to load user auth token.')}
              onRetry={refetchToken}
            />
          )}

          {isPending && <LoadingIndicator />}

          {!isPending && !isError && token && <ApiTokenDetailsForm token={token} />}
        </PanelBody>
      </Panel>
    </div>
  );
}

export default ApiTokenDetails;
