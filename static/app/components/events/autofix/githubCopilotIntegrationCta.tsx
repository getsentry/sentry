import {Container, Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {ExternalLink} from 'sentry/components/core/link';
import {useCodingAgentIntegrations} from 'sentry/components/events/autofix/useAutofix';
import Placeholder from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import useOrganization from 'sentry/utils/useOrganization';

export function GithubCopilotIntegrationCta() {
  const organization = useOrganization();

  const {data: codingAgentIntegrations, isLoading: isLoadingIntegrations} =
    useCodingAgentIntegrations();

  const githubCopilotIntegration = codingAgentIntegrations?.integrations.find(
    integration => integration.provider === 'github_copilot'
  );

  const hasGithubCopilotFeatureFlag = organization.features.includes(
    'integrations-github-copilot-agent'
  );
  const hasGithubCopilotIntegration = Boolean(githubCopilotIntegration);

  if (!hasGithubCopilotFeatureFlag) {
    return null;
  }

  if (isLoadingIntegrations) {
    return (
      <Container
        padding="xl"
        border="primary"
        radius="md"
        marginTop="2xl"
        marginBottom="2xl"
      >
        <Placeholder height="120px" />
      </Container>
    );
  }

  if (!hasGithubCopilotIntegration) {
    return (
      <Container
        padding="xl"
        border="primary"
        radius="md"
        marginTop="2xl"
        marginBottom="2xl"
      >
        <Flex direction="column" gap="lg">
          <Heading as="h3">
            <Flex direction="row" gap="sm" align="center">
              <PluginIcon pluginId="github" /> <span>GitHub Copilot Integration</span>
            </Flex>
          </Heading>
          <Text>
            {tct(
              'Connect GitHub Copilot to hand off Seer root cause analysis to GitHub Copilot coding agent for seamless code fixes. [docsLink:Read the docs] to learn more.',
              {
                docsLink: (
                  <ExternalLink href="https://docs.sentry.io/organization/integrations/github-copilot/" />
                ),
              }
            )}
          </Text>
          <div>
            <LinkButton
              to={`/settings/${organization.slug}/integrations/github_copilot/`}
              priority="default"
              size="sm"
            >
              {t('Install GitHub Copilot Integration')}
            </LinkButton>
          </div>
        </Flex>
      </Container>
    );
  }

  return (
    <Container
      padding="xl"
      border="primary"
      radius="md"
      marginTop="2xl"
      marginBottom="2xl"
    >
      <Flex direction="column" gap="lg">
        <Heading as="h3">
          <Flex direction="row" gap="sm" align="center">
            <PluginIcon pluginId="github" /> <span>GitHub Copilot Integration</span>
          </Flex>
        </Heading>
        <Text>
          {tct(
            'GitHub Copilot integration is installed. You can trigger GitHub Copilot from Issue Fix to create pull requests. [docsLink:Read the docs] to learn more.',
            {
              docsLink: (
                <ExternalLink href="https://docs.sentry.io/organization/integrations/github-copilot/" />
              ),
            }
          )}
        </Text>
      </Flex>
    </Container>
  );
}
