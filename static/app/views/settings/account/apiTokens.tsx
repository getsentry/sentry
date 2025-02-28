import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {LinkButton} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {InternalAppApiToken} from 'sentry/types/user';
import {isDemoModeEnabled} from 'sentry/utils/demoMode';
import {
  getApiQueryData,
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import ApiTokenRow from 'sentry/views/settings/account/apiTokenRow';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

const PAGE_TITLE = t('User Auth Tokens');
const API_TOKEN_QUERY_KEY = ['/api-tokens/'] as const;

export function ApiTokens() {
  const api = useApi();
  const queryClient = useQueryClient();

  const {
    data: tokenList = [],
    isLoading,
    isError,
    refetch,
  } = useApiQuery<InternalAppApiToken[]>(API_TOKEN_QUERY_KEY, {
    staleTime: 0,
    enabled: !isDemoModeEnabled(),
  });

  const {mutate: deleteToken} = useMutation({
    mutationFn: (token: InternalAppApiToken) => {
      return api.requestPromise('/api-tokens/', {
        method: 'DELETE',
        data: {tokenId: token.id},
      });
    },
    onMutate: token => {
      addLoadingMessage();
      queryClient.cancelQueries({queryKey: API_TOKEN_QUERY_KEY});

      const previous = getApiQueryData<InternalAppApiToken[]>(
        queryClient,
        API_TOKEN_QUERY_KEY
      );

      setApiQueryData<InternalAppApiToken[]>(
        queryClient,
        API_TOKEN_QUERY_KEY,
        oldTokenList => {
          return oldTokenList?.filter(tk => tk.id !== token.id);
        }
      );

      return {previous};
    },
    onSuccess: _data => {
      addSuccessMessage(t('Removed token'));
    },
    onError: (_error, _variables, context) => {
      addErrorMessage(t('Unable to remove token. Please try again.'));

      if (context?.previous) {
        setApiQueryData<InternalAppApiToken[]>(
          queryClient,
          API_TOKEN_QUERY_KEY,
          context.previous
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: API_TOKEN_QUERY_KEY});
    },
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const isEmpty = !Array.isArray(tokenList) || tokenList.length === 0;

  const action = (
    <LinkButton
      priority="primary"
      size="sm"
      to="/settings/account/api/auth-tokens/new-token/"
    >
      {t('Create New Token')}
    </LinkButton>
  );

  return (
    <SentryDocumentTitle title={PAGE_TITLE}>
      <SettingsPageHeader title={PAGE_TITLE} action={action} />
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
        <PanelHeader>{t('Auth Token')}</PanelHeader>

        <PanelBody>
          {isEmpty && (
            <EmptyMessage>
              {t("You haven't created any authentication tokens yet.")}
            </EmptyMessage>
          )}

          {tokenList?.map(token => (
            <ApiTokenRow key={token.id} token={token} onRemove={deleteToken} canEdit />
          ))}
        </PanelBody>
      </Panel>
    </SentryDocumentTitle>
  );
}

export default ApiTokens;
