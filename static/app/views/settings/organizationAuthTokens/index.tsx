import {Fragment} from 'react';
import styled from '@emotion/styled';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';

import {LinkButton} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import type {TableColumnConfig} from '@sentry/scraps/table';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Access} from 'sentry/components/acl/access';
import {LoadingError} from 'sentry/components/loadingError';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {OrgAuthToken} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {setApiQueryData, useApiQuery} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {OrganizationAuthTokensAuthTokenRow} from 'sentry/views/settings/organizationAuthTokens/authTokenRow';

type FetchOrgAuthTokensResponse = OrgAuthToken[];
type FetchOrgAuthTokensParameters = {
  orgSlug: string;
};
type RevokeTokenQueryVariables = {
  token: OrgAuthToken;
};

const TOKEN_COLUMNS: TableColumnConfig[] = [
  {key: 'token', width: 'auto'},
  {key: 'created', width: 'auto'},
  {key: 'lastAccess', width: 'auto'},
  {key: 'actions', width: 'auto'},
];

export const makeFetchOrgAuthTokensForOrgQueryKey = ({
  orgSlug,
}: FetchOrgAuthTokensParameters) =>
  [
    getApiUrl('/organizations/$organizationIdOrSlug/org-auth-tokens/', {
      path: {organizationIdOrSlug: orgSlug},
    }),
  ] as const;

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
  const projectIds = tokenList
    .map(token => token.projectLastUsedId)
    .filter(id => !!id) as string[];

  const idQueryParams = projectIds.map(id => `id:${id}`).join(' ');

  const hasProjects = projectIds.length > 0;

  const {data: projects, isPending: isLoadingProjects} = useQuery({
    ...apiOptions.as<Project[]>()('/organizations/$organizationIdOrSlug/projects/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        query: idQueryParams,
        collapse: ['latestDeploys', 'unusedFeatures'],
      },
      staleTime: 0,
    }),
    enabled: hasProjects,
  });

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

function OrganizationAuthTokensIndex() {
  const organization = useOrganization();
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
      variant="primary"
      size="md"
      icon={<IconAdd />}
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
          <SentryDocumentTitle
            title={t('Organization Tokens')}
            orgSlug={organization.slug}
          />
          <SettingsPageHeader
            title={t('Organization Tokens')}
            action={createNewToken}
            subtitle={
              <Stack gap="md">
                <div>
                  {t(
                    'Organization tokens can be used in many places to interact with Sentry programmatically. For example, they can be used for sentry-cli, bundler plugins or similar uses cases.'
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

          <ResponsiveSimpleTable
            columns={TOKEN_COLUMNS}
            header={
              <SimpleTable.HeaderRow>
                <SimpleTable.HeaderCell>{t('Token')}</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell>{t('Created')}</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell>{t('Last access')}</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell />
              </SimpleTable.HeaderRow>
            }
          >
            {isError && (
              <SimpleTable.Empty>
                <LoadingError
                  message={t('Failed to load organization tokens.')}
                  onRetry={refetchTokenList}
                />
              </SimpleTable.Empty>
            )}
            {!isError && isPending && <SimpleTable.Loading />}
            {!isError && !isPending && !tokenList?.length && (
              <SimpleTable.Empty>
                {t("You haven't created any authentication tokens yet.")}
              </SimpleTable.Empty>
            )}
            {!isError && !isPending && !!tokenList?.length && (
              <TokenList
                organization={organization}
                tokenList={tokenList}
                isRevoking={isRevoking}
                revokeToken={hasAccess ? handleRevokeToken : undefined}
              />
            )}
          </ResponsiveSimpleTable>
        </Fragment>
      )}
    </Access>
  );
}

export function tokenPreview(tokenLastCharacters: string, tokenPrefix = '') {
  return `${tokenPrefix}************${tokenLastCharacters}`;
}

const ResponsiveSimpleTable = styled(SimpleTable)`
  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 1fr 1fr;

    /* Hide the "Created" and "Last access" columns; the flat nth-child(4n + x)
       form this replaced counted cells across the whole grid. */
    [role='columnheader']:nth-child(2),
    [role='columnheader']:nth-child(3),
    [role='cell']:nth-child(2),
    [role='cell']:nth-child(3) {
      display: none;
    }
  }
`;

export default OrganizationAuthTokensIndex;
