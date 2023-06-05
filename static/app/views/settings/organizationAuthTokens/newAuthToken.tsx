import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

export function OrganizationAuthTokensNewAuthToken(_props: {organization: Organization}) {
  return (
    <div>
      <SentryDocumentTitle title={t('Create New Auth Token')} />
      <SettingsPageHeader title={t('Create New Auth Token')} />

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
        <PanelHeader>{t('Create New Auth Token')}</PanelHeader>

        <PanelBody>
          <EmptyMessage>Coming soon</EmptyMessage>
        </PanelBody>
      </Panel>
    </div>
  );
}

export default withOrganization(OrganizationAuthTokensNewAuthToken);
