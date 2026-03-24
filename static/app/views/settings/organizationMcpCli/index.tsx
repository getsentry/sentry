import {Fragment} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {TextCopyInput} from 'sentry/components/textCopyInput';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {TextBlock} from 'sentry/views/settings/components/text/textBlock';

export default function OrganizationMcpCli() {
  const organization = useOrganization();

  return (
    <Fragment>
      <SentryDocumentTitle title={t('MCP & CLI')} orgSlug={organization.slug} />
      <SettingsPageHeader title={t('MCP & CLI')} />
      <TextBlock>
        {t('Connect to Sentry from AI-powered development tools and your terminal.')}
      </TextBlock>

      <Flex direction="column" gap="xl">
        <Container padding="xl" border="primary" radius="md">
          <Flex direction="column" gap="lg">
            <Heading as="h3">{t('MCP Server')}</Heading>
            <Text variant="muted" size="lg">
              {t(
                'Add this URL as a streamable HTTP MCP server in your client. Authentication happens automatically via your browser.'
              )}
            </Text>
            <TextCopyInput>https://mcp.sentry.dev/mcp</TextCopyInput>
            <Text variant="muted">
              {t(
                'You can scope the connection to a specific organization or project by appending query parameters to the URL:'
              )}
            </Text>
            <TextCopyInput>
              https://mcp.sentry.dev/mcp/example-org/example-project
            </TextCopyInput>
            <div>
              <LinkButton href="https://mcp.sentry.dev" external priority="default">
                {t('MCP Documentation')}
              </LinkButton>
            </div>
          </Flex>
        </Container>

        <Container padding="xl" border="primary" radius="md">
          <Flex direction="column" gap="lg">
            <Heading as="h3">{t('Sentry CLI')}</Heading>
            <Text variant="muted" size="lg">
              {t(
                'Install the Sentry CLI and authenticate to manage releases, source maps, debug symbols, and more from your terminal.'
              )}
            </Text>
            <TextCopyInput>curl https://cli.sentry.dev/install -fsS | bash</TextCopyInput>
            <TextCopyInput>sentry auth login</TextCopyInput>
            <div>
              <LinkButton href="https://cli.sentry.dev" external priority="default">
                {t('CLI Documentation')}
              </LinkButton>
            </div>
          </Flex>
        </Container>
      </Flex>
    </Fragment>
  );
}
