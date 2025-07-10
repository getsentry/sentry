import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PanelTable} from 'sentry/components/panels/panelTable';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {InternalAppApiToken} from 'sentry/types/user';
import {isDemoModeActive} from 'sentry/utils/demoMode';
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

const PAGE_TITLE = t('Personal Tokens');
const API_TOKEN_QUERY_KEY = ['/api-tokens/'] as const;

function ApiTokens() {
  const api = useApi();
  const queryClient = useQueryClient();

  const {
    data: tokenList = [],
    isLoading,
    isError,
    refetch,
  } = useApiQuery<InternalAppApiToken[]>(API_TOKEN_QUERY_KEY, {
    staleTime: 0,
    enabled: !isDemoModeActive(),
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
      <PanelTable
        headers={[t('Token'), t('Created On'), t('Scopes'), '']}
        isEmpty={isEmpty}
        emptyMessage={t("You haven't created any authentication tokens yet.")}
      >
        {tokenList?.map(token => (
          <ApiTokenRow key={token.id} token={token} onRemove={deleteToken} canEdit />
        ))}
      </PanelTable>
    </SentryDocumentTitle>
  );
}

export default ApiTokens;
