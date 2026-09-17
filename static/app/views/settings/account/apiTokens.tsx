import {useMutation, useQueryClient} from '@tanstack/react-query';

import {LinkButton} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import type {TableColumnConfig} from '@sentry/scraps/table';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {InternalAppApiToken} from 'sentry/types/user';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {getApiQueryData, setApiQueryData, useApiQuery} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {ApiTokenRow} from 'sentry/views/settings/account/apiTokenRow';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

const PAGE_TITLE = t('Personal Tokens');
const API_TOKEN_QUERY_KEY = [getApiUrl('/api-tokens/')] as const;

const API_TOKEN_COLUMNS: TableColumnConfig[] = [
  {key: 'token'},
  {key: 'created'},
  {key: 'scopes'},
  {key: 'actions', width: 'min-content'},
];

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
      variant="primary"
      size="md"
      icon={<IconAdd />}
      to="/settings/account/api/auth-tokens/new-token/"
    >
      {t('Create New Token')}
    </LinkButton>
  );

  return (
    <SentryDocumentTitle title={PAGE_TITLE}>
      <SettingsPageHeader
        title={PAGE_TITLE}
        action={action}
        subtitle={
          <Stack gap="md">
            <div>
              {t(
                "Personal tokens allow you to perform actions against the Sentry API on behalf of your account. They're the easiest way to get started using the API."
              )}
            </div>
            <div>
              {tct(
                'For more information on how to use the web API, see our [link:documentation].',
                {
                  link: <ExternalLink href="https://docs.sentry.io/api/" />,
                }
              )}
            </div>
          </Stack>
        }
      />
      <SimpleTable
        columns={API_TOKEN_COLUMNS}
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Token')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Created On')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Scopes')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell />
          </SimpleTable.HeaderRow>
        }
      >
        {isEmpty ? (
          <SimpleTable.Empty>
            {t("You haven't created any authentication tokens yet.")}
          </SimpleTable.Empty>
        ) : (
          tokenList?.map(token => (
            <ApiTokenRow key={token.id} token={token} onRemove={deleteToken} canEdit />
          ))
        )}
      </SimpleTable>
    </SentryDocumentTitle>
  );
}

export default ApiTokens;
