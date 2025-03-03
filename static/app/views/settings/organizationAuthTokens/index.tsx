import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Access from 'sentry/components/acl/access';
import {LinkButton} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import {PanelTable} from 'sentry/components/panels/panelTable';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {OrgAuthToken} from 'sentry/types/user';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {OrganizationAuthTokensAuthTokenRow} from 'sentry/views/settings/organizationAuthTokens/authTokenRow';

type FetchOrgAuthTokensResponse = OrgAuthToken[];
type FetchOrgAuthTokensParameters = {
  orgSlug: string;
};
type RevokeTokenQueryVariables = {
  token: OrgAuthToken;
};

export const makeFetchOrgAuthTokensForOrgQueryKey = ({
  orgSlug,
}: FetchOrgAuthTokensParameters) =>
  [`/organizations/${orgSlug}/org-auth-tokens/`] as const;

function TokenList({
  organization,
  tokenList,
  isRevoking,
  revokeToken,
}: {
  isRevoking: boolean;
  organization: Organization;
  tokenList: OrgAuthToken[];
  revokeToken?: (data: {token: OrgAuthToken}) => void;
}) {
  const apiEndpoint = `/organizations/${organization.slug}/projects/`;

  const projectIds = tokenList
    .map(token => token.projectLastUsedId)
    .filter(id => !!id) as string[];

  const idQueryParams = projectIds.map(id => `id:${id}`).join(' ');

  const hasProjects = projectIds.length > 0;

  const {data: projects, isPending: isLoadingProjects} = useApiQuery<Project[]>(
    [apiEndpoint, {query: {query: idQueryParams}}],
    {
      staleTime: 0,
      enabled: hasProjects,
    }
  );

  return (
    <Fragment>
      {tokenList.map(token => {
        const projectLastUsed = token.projectLastUsedId
          ? projects?.find(p => p.id === token.projectLastUsedId)
          : undefined;
        return (
          <OrganizationAuthTokensAuthTokenRow
            key={token.id}
            organization={organization}
            token={token}
            isRevoking={isRevoking}
            revokeToken={revokeToken ? () => revokeToken({token}) : undefined}
            projectLastUsed={projectLastUsed}
            isProjectLoading={hasProjects && isLoadingProjects}
          />
        );
      })}
    </Fragment>
  );
}

export function OrganizationAuthTokensIndex({
  organization,
}: {
  organization: Organization;
}) {
  const api = useApi();
  const queryClient = useQueryClient();

  const {
    isPending,
    isError,
    data: tokenList,
    refetch: refetchTokenList,
  } = useApiQuery<FetchOrgAuthTokensResponse>(
    makeFetchOrgAuthTokensForOrgQueryKey({orgSlug: organization.slug}),
    {
      staleTime: Infinity,
    }
  );

  const {mutate: handleRevokeToken, isPending: isRevoking} = useMutation<
    unknown,
    RequestError,
    RevokeTokenQueryVariables
  >({
    mutationFn: ({token}) =>
      api.requestPromise(
        `/organizations/${organization.slug}/org-auth-tokens/${token.id}/`,
        {
          method: 'DELETE',
        }
      ),

    onSuccess: (_data, {token}) => {
      addSuccessMessage(t('Revoked auth token for the organization.'));

      setApiQueryData(
        queryClient,
        makeFetchOrgAuthTokensForOrgQueryKey({orgSlug: organization.slug}),
        oldData => {
          if (!Array.isArray(oldData)) {
            return oldData;
          }

          return oldData.filter(oldToken => oldToken.id !== token.id);
        }
      );
    },
    onError: error => {
      const message = t('Failed to revoke the auth token for the organization.');
      handleXhrErrorResponse(message, error);
      addErrorMessage(message);
    },
  });

  const createNewToken = (
    <LinkButton
      priority="primary"
      size="sm"
      to={`/settings/${organization.slug}/auth-tokens/new-token/`}
      data-test-id="create-token"
    >
      {t('Create New Token')}
    </LinkButton>
  );

  return (
    <Access access={['org:write']}>
      {({hasAccess}) => (
        <Fragment>
          <SentryDocumentTitle title={t('Auth Tokens')} orgSlug={organization.slug} />
          <SettingsPageHeader title={t('Auth Tokens')} action={createNewToken} />

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

          <ResponsivePanelTable
            isLoading={isPending || isError}
            isEmpty={!isPending && !tokenList?.length}
            loader={
              isError ? (
                <LoadingError
                  message={t('Failed to load auth tokens for the organization.')}
                  onRetry={refetchTokenList}
                />
              ) : undefined
            }
            emptyMessage={t("You haven't created any authentication tokens yet.")}
            headers={[t('Auth token'), t('Created'), t('Last access'), '']}
          >
            {!isError && !isPending && !!tokenList?.length && (
              <TokenList
                organization={organization}
                tokenList={tokenList}
                isRevoking={isRevoking}
                revokeToken={hasAccess ? handleRevokeToken : undefined}
              />
            )}
          </ResponsivePanelTable>
        </Fragment>
      )}
    </Access>
  );
}

export function tokenPreview(tokenLastCharacters: string, tokenPrefix = '') {
  return `${tokenPrefix}************${tokenLastCharacters}`;
}

export default withOrganization(OrganizationAuthTokensIndex);

const ResponsivePanelTable = styled(PanelTable)`
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 1fr 1fr;

    > *:nth-child(4n + 2),
    > *:nth-child(4n + 3) {
      display: none;
    }
  }
`;
