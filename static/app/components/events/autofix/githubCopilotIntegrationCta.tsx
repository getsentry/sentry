import {useQuery} from '@tanstack/react-query';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {organizationIntegrationsCodingAgents} from 'sentry/components/events/autofix/useAutofix';
import {Placeholder} from 'sentry/components/placeholder';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

export function GithubCopilotIntegrationCta() {
  const organization = useOrganization();
  const user = useUser();

  const {data: codingAgentIntegrations, isLoading: isLoadingIntegrations} = useQuery(
    organizationIntegrationsCodingAgents(organization)
  );

  const handleInstallClick = () => {
    trackAnalytics('coding_integration.install_clicked', {
      organization,
      project_slug: '', // GitHub Copilot CTA is not project-specific
      provider: 'github_copilot',
      source: 'cta',
      user_id: user.id,
    });
  };

  const githubCopilotIntegration = codingAgentIntegrations?.integrations.find(
    integration => integration.provider === 'github_copilot'
  );

  const hasGithubCopilotIntegration = Boolean(githubCopilotIntegration);

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
        <Stack gap="lg">
          <Heading as="h3">
            <Flex direction="row" gap="sm" align="center">
              <PluginIcon pluginId="github" /> <span>GitHub Copilot Integration</span>
            </Flex>
          </Heading>
          <Text>
            {t(
              'Connect GitHub Copilot to hand off Seer root cause analysis to GitHub Copilot coding agent for seamless code fixes.'
            )}
          </Text>
          <div>
            <LinkButton
              to={`/settings/${organization.slug}/integrations/github_copilot/`}
              variant="secondary"
              size="sm"
              onClick={handleInstallClick}
            >
              {t('Install GitHub Copilot Integration')}
            </LinkButton>
          </div>
        </Stack>
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
      <Stack gap="lg">
        <Heading as="h3">
          <Flex direction="row" gap="sm" align="center">
            <PluginIcon pluginId="github" /> <span>GitHub Copilot Integration</span>
          </Flex>
        </Heading>
        <Text>
          {t(
            'GitHub Copilot integration is installed. You can trigger GitHub Copilot from Issue Fix to create pull requests.'
          )}
        </Text>
      </Stack>
    </Container>
  );
}
