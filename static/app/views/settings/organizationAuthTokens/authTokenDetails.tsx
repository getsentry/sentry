import {useCallback, useEffect, useState} from 'react';
import {browserHistory} from 'react-router';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Alert from 'sentry/components/alert';
import {Form, TextField} from 'sentry/components/forms';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {setDateToTime} from 'sentry/utils/dates';
import getDynamicText from 'sentry/utils/getDynamicText';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {tokenPreview, TokenWip} from 'sentry/views/settings/organizationAuthTokens';

function generateMockToken({
  id,
  name,
  scopes,
  dateCreated = new Date(),
  dateLastUsed,
  projectLastUsed,
}: {
  id: string;
  name: string;
  scopes: string[];
  dateCreated?: Date;
  dateLastUsed?: Date;
  projectLastUsed?: Project;
}): TokenWip {
  return {
    id,
    name,
    tokenLastCharacters: crypto.randomUUID().slice(0, 4),
    scopes,
    dateCreated,
    dateLastUsed,
    projectLastUsed,
  };
}

type Props = {
  organization: Organization;
  params: {tokenId: string};
};

function AuthTokenDetailsForm({
  token,
  organization,
}: {
  organization: Organization;
  token: TokenWip;
}) {
  const initialData = {
    name: token.name,
    tokenPreview: tokenPreview(token.tokenLastCharacters || '****'),
  };

  return (
    <Form
      apiMethod="PUT"
      initialData={initialData}
      apiEndpoint={`/organizations/${organization.slug}/auth-tokens/${token.id}/`}
      onSubmit={() => {
        // TODO FN: Actually submit data

        try {
          const message = t('Successfully updated the auth token.');
          addSuccessMessage(message);
        } catch (error) {
          const message = t('Failed to update the auth token.');
          handleXhrErrorResponse(message, error);
          addErrorMessage(message);
        }
      }}
      onCancel={() =>
        browserHistory.push(normalizeUrl(`/settings/${organization.slug}/auth-tokens/`))
      }
    >
      <TextField
        name="name"
        label={t('Name')}
        value={token.dateLastUsed}
        required
        help={t('A name to help you identify this token.')}
      />

      <TextField
        name="tokenPreview"
        label={t('Token')}
        value={tokenPreview(
          token.tokenLastCharacters
            ? getDynamicText({
                value: token.tokenLastCharacters,
                fixed: 'ABCD',
              })
            : '****'
        )}
        disabled
        help={t('You can only view the token once after creation.')}
      />

      <FieldGroup
        label={t('Scopes')}
        inline={false}
        help={t(
          'You cannot change the scopes of an existing token. If you need different scopes, please create a new token.'
        )}
      >
        <div>{token.scopes.slice().sort().join(', ')}</div>
      </FieldGroup>
    </Form>
  );
}

export function OrganizationAuthTokensDetails({params, organization}: Props) {
  const [token, setToken] = useState<TokenWip | null>(null);
  const [hasLoadingError, setHasLoadingError] = useState(false);

  const {tokenId} = params;

  const fetchToken = useCallback(async () => {
    try {
      // TODO FN: Actually do something here
      await new Promise(resolve => setTimeout(resolve, 500));
      setToken(
        generateMockToken({
          id: tokenId,
          name: 'custom token',
          scopes: ['org:ci'],
          dateLastUsed: setDateToTime(new Date(), '00:05:00'),
          projectLastUsed: {slug: 'my-project', name: 'My Project'} as Project,
          dateCreated: setDateToTime(new Date(), '00:01:00'),
        })
      );
      setHasLoadingError(false);
    } catch (error) {
      const message = t('Failed to load auth token.');
      handleXhrErrorResponse(message, error);
      setHasLoadingError(error);
    }
  }, [tokenId]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  return (
    <div>
      <SentryDocumentTitle title={t('Edit Auth Token')} />
      <SettingsPageHeader title={t('Edit Auth Token')} />

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
        <PanelHeader>{t('Auth Token Details')}</PanelHeader>

        <PanelBody>
          {hasLoadingError && (
            <LoadingError
              message={t('Failed to load auth token.')}
              onRetry={fetchToken}
            />
          )}

          {!hasLoadingError && !token && <LoadingIndicator />}

          {!hasLoadingError && token && (
            <AuthTokenDetailsForm token={token} organization={organization} />
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}

export default withOrganization(OrganizationAuthTokensDetails);
