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
                'Connect AI assistants to Sentry for searching errors, analyzing performance, triaging issues, and managing projects via the Model Context Protocol. Add this URL as a streamable HTTP MCP server in your client.'
              )}
            </Text>
            <TextCopyInput>https://mcp.sentry.dev/mcp</TextCopyInput>
            <Text variant="muted">
              {t(
                'You can scope the connection to a specific organization or project. Scoping to a project is recommended when possible — it sets defaults automatically and hides unnecessary discovery tools.'
              )}
            </Text>
            <TextCopyInput>https://mcp.sentry.dev/mcp/your-org</TextCopyInput>
            <TextCopyInput>
              https://mcp.sentry.dev/mcp/your-org/your-project
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
                'A command-line tool for developers and agents. Browse issues, get AI-powered root cause analysis, autodetect your project, and pipe structured output to your favorite tools.'
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
