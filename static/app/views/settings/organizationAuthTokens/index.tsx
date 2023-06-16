import {Fragment, useCallback, useEffect, useState} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Access from 'sentry/components/acl/access';
import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {setDateToTime} from 'sentry/utils/dates';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {OrganizationAuthTokensAuthTokenRow} from 'sentry/views/settings/organizationAuthTokens/authTokenRow';

export type TokenWip = {
  dateCreated: Date;
  id: string;
  name: string;
  scopes: string[];
  dateLastUsed?: Date;
  projectLastUsed?: Project;
  tokenLastCharacters?: string;
};

function generateMockToken({
  name,
  scopes,
  dateCreated = new Date(),
  dateLastUsed,
  projectLastUsed,
}: {
  name: string;
  scopes: string[];
  dateCreated?: Date;
  dateLastUsed?: Date;
  projectLastUsed?: Project;
}): TokenWip {
  return {
    id: crypto.randomUUID(),
    name,
    tokenLastCharacters: crypto.randomUUID().slice(0, 4),
    scopes,
    dateCreated,
    dateLastUsed,
    projectLastUsed,
  };
}

export function OrganizationAuthTokensIndex({
  organization,
}: {
  organization: Organization;
}) {
  const [tokenList, setTokenList] = useState<TokenWip[] | null>(null);
  const [hasLoadingError, setHasLoadingError] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  const fetchTokenList = useCallback(async () => {
    try {
      // TODO FN: Actually do something here
      await new Promise(resolve => setTimeout(resolve, 500));
      setTokenList([
        generateMockToken({
          name: 'custom token',
          scopes: ['org:ci'],
          dateLastUsed: setDateToTime(new Date(), '00:05:00'),
          projectLastUsed: {slug: 'my-project', name: 'My Project'} as Project,
          dateCreated: setDateToTime(new Date(), '00:01:00'),
        }),
        generateMockToken({
          name: 'my-project CI token',
          scopes: ['org:ci'],
          dateLastUsed: new Date('2023-06-09'),
        }),
        generateMockToken({name: 'my-pro2 CI token', scopes: ['org:ci']}),
      ]);
      setHasLoadingError(false);
    } catch (error) {
      const message = t('Failed to load auth tokens for the organization.');
      handleXhrErrorResponse(message, error);
      setHasLoadingError(error);
    }
  }, []);

  const handleRevokeToken = useCallback(
    async (token: TokenWip) => {
      try {
        setIsRevoking(true);
        // TODO FN: Actually do something here
        await new Promise(resolve => setTimeout(resolve, 500));
        const newTokens = (tokenList || []).filter(
          tokenCompare => tokenCompare !== token
        );
        setTokenList(newTokens);

        addSuccessMessage(t('Revoked auth token for the organization.'));
      } catch (error) {
        const message = t('Failed to revoke the auth token for the organization.');
        handleXhrErrorResponse(message, error);
        addErrorMessage(message);
      } finally {
        setIsRevoking(false);
      }
    },
    [tokenList]
  );

  const createNewToken = (
    <Button
      priority="primary"
      size="sm"
      to={`/settings/${organization.slug}/auth-tokens/new-token/`}
      data-test-id="create-token"
    >
      {t('Create New Token')}
    </Button>
  );

  useEffect(() => {
    fetchTokenList();
  }, [fetchTokenList]);

  return (
    <Access access={['org:write']}>
      {({hasAccess}) => (
        <Fragment>
          <SentryDocumentTitle title={t('Auth Tokens')} />
          <SettingsPageHeader title={t('Auth Tokens')} action={createNewToken} />

          <Alert>Note: This page is WIP and currently only shows mocked data.</Alert>

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
            <PanelHeader>{t('Auth Token')}</PanelHeader>

            <PanelBody>
              {hasLoadingError && (
                <LoadingError
                  message={t('Failed to load auth tokens for the organization.')}
                  onRetry={fetchTokenList}
                />
              )}

              {!hasLoadingError && !tokenList && <LoadingIndicator />}

              {!hasLoadingError && tokenList && tokenList.length === 0 && (
                <EmptyMessage>
                  {t("You haven't created any authentication tokens yet.")}
                </EmptyMessage>
              )}

              {!hasLoadingError &&
                tokenList &&
                tokenList.length > 0 &&
                tokenList.map(token => (
                  <OrganizationAuthTokensAuthTokenRow
                    key={token.id}
                    organization={organization}
                    token={token}
                    isRevoking={isRevoking}
                    revokeToken={hasAccess ? handleRevokeToken : () => {}}
                    canRevoke={hasAccess}
                  />
                ))}
            </PanelBody>
          </Panel>
        </Fragment>
      )}
    </Access>
  );
}

export function tokenPreview(tokenLastCharacters: string) {
  return `sntrys_************${tokenLastCharacters}`;
}

export default withOrganization(OrganizationAuthTokensIndex);
