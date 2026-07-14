import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import type {SeerAutomationHandoffConfiguration} from 'sentry/components/events/autofix/types';
import {Placeholder} from 'sentry/components/placeholder';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {knownAgentIntegrationsQueryOptions} from 'sentry/utils/seer/preferredAgent';
import {
  getMutateSeerProjectSettingsOptions,
  getSeerProjectSettingsQueryOptions,
} from 'sentry/utils/seer/seerProjectSettings';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

interface CodingAgentIntegrationCtaProps {
  project: Project;
}

interface AgentConfig {
  displayName: string;
  docsUrl: string;
  pluginId: string;
  provider: string;
  target: SeerAutomationHandoffConfiguration['target'];
  // If unset, the CTA renders without a feature flag gate.
  featureFlag?: string;
  headingName?: string;
}

export function makeCodingAgentIntegrationCta(config: AgentConfig) {
  const headingLabel = config.headingName ?? config.displayName;

  return function CodingAgentIntegrationCta({project}: CodingAgentIntegrationCtaProps) {
    const organization = useOrganization();
    const user = useUser();
    const queryClient = useQueryClient();

    const hasFeatureFlag =
      !config.featureFlag || organization.features.includes(config.featureFlag);
    const {data: projectDetails, isPending: isLoadingProject} = useDetailedProject(
      {
        orgSlug: organization.slug,
        projectSlug: project.slug,
      },
      {enabled: hasFeatureFlag}
    );
    const {data: knownAgents, isLoading: isLoadingIntegrations} = useQuery(
      knownAgentIntegrationsQueryOptions({organization})
    );

    const integration = knownAgents?.find(i => i.provider === config.target);
    const hasIntegration = Boolean(integration);

    // Only the configured/not-configured states need the project's Seer setting;
    // without an integration the CTA short-circuits to the install card, so skip
    // the fetch entirely until we know an integration exists.
    const {data: seerSettings, isLoading: isLoadingSettings} = useQuery({
      ...getSeerProjectSettingsQueryOptions({organization, project}),
      enabled: hasIntegration,
    });
    const {mutate: updateSeerSettings, isPending: isUpdatingSettings} = useMutation(
      getMutateSeerProjectSettingsOptions({
        organization,
        project,
        queryClient,
        knownAgents,
      })
    );
    const {mutateAsync: updateProjectAutomation} = useUpdateProject(project);

    const isAutomationEnabled =
      projectDetails?.seerScannerAutomation !== false &&
      projectDetails?.autofixAutomationTuning !== 'off';
    const isConfigured = seerSettings?.agent === config.target && isAutomationEnabled;

    const handleInstallClick = () => {
      trackAnalytics('coding_integration.install_clicked', {
        organization,
        project_slug: project.slug,
        provider: config.provider,
        source: 'cta',
        user_id: user.id,
      });
    };

    const handleSetupClick = async () => {
      if (!integration?.id) {
        throw new Error(`${config.displayName} integration not found`);
      }

      trackAnalytics('coding_integration.setup_handoff_clicked', {
        organization,
        project_slug: project.slug,
        provider: config.provider,
        source: 'cta',
        user_id: user.id,
      });

      const isAutomationDisabled =
        projectDetails?.seerScannerAutomation === false ||
        projectDetails?.autofixAutomationTuning === 'off';

      if (isAutomationDisabled) {
        await updateProjectAutomation({
          autofixAutomationTuning: 'low',
          seerScannerAutomation: true,
        });
      }

      updateSeerSettings({
        agentOption: `${config.target}::${integration.id}`,
        stoppingPoint: 'root_cause',
        autoCreatePr: false,
      });
    };

    if (!hasFeatureFlag) {
      return null;
    }

    if (
      isLoadingProject ||
      isLoadingSettings ||
      isLoadingIntegrations ||
      isUpdatingSettings
    ) {
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

    if (!hasIntegration) {
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
                <PluginIcon pluginId={config.pluginId} />{' '}
                <span>{headingLabel} Integration</span>
              </Flex>
            </Heading>
            <Text>
              {tct(
                'Connect [name] to automatically hand off Seer root cause analysis to [name] Agents for seamless code fixes. [docsLink:Read the docs] to learn more.',
                {
                  name: config.displayName,
                  docsLink: <ExternalLink href={config.docsUrl} />,
                }
              )}
            </Text>
            <div>
              <LinkButton
                href={`/settings/${organization.slug}/integrations/${config.pluginId}/`}
                variant="secondary"
                size="sm"
                onClick={handleInstallClick}
              >
                {t('Install %s Integration', config.displayName)}
              </LinkButton>
            </div>
          </Stack>
        </Container>
      );
    }

    if (!isConfigured) {
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
                <PluginIcon pluginId={config.pluginId} />{' '}
                <span>{headingLabel} Integration</span>
              </Flex>
            </Heading>
            <Text>
              {tct(
                'You have the [name] integration installed. Turn on Seer automation and set up hand off to trigger [name] Agents during automation. [seerProjectSettings:Configure in Seer project settings] or [docsLink:read the docs] to learn more.',
                {
                  name: config.displayName,
                  seerProjectSettings: (
                    <Link
                      to={`/settings/${organization.slug}/projects/${project.slug}/seer/`}
                    />
                  ),
                  docsLink: <ExternalLink href={config.docsUrl} />,
                }
              )}
            </Text>
            <div>
              <Button onClick={handleSetupClick} variant="secondary" size="sm">
                {t('Set Seer to hand off to %s', config.displayName)}
              </Button>
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
              <PluginIcon pluginId={config.pluginId} />{' '}
              <span>{headingLabel} Integration</span>
            </Flex>
          </Heading>
          <Text>
            {tct(
              '[name] handoff is active. During automation runs, Seer will automatically trigger [name] Agents. [docsLink:Read the docs] to learn more.',
              {
                name: config.displayName,
                docsLink: <ExternalLink href={config.docsUrl} />,
              }
            )}
          </Text>
        </Stack>
      </Container>
    );
  };
}
