import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

export function OrganizationAuthTokensIndex({
  organization,
}: {
  organization: Organization;
}) {
  const isEmpty = true;
  const tokenList = [];

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

  return (
    <div>
      <SentryDocumentTitle title={t('Auth Tokens')} />
      <SettingsPageHeader title={t('Auth Tokens')} action={createNewToken} />

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
          {isEmpty && (
            <EmptyMessage>
              {t("You haven't created any authentication tokens yet.")}
            </EmptyMessage>
          )}

          {tokenList?.map(token => (
            <div key={token}>{token}</div>
          ))}
        </PanelBody>
      </Panel>
    </div>
  );
}

export default withOrganization(OrganizationAuthTokensIndex);
