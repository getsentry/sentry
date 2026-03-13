import {useCallback} from 'react';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {useUpdateProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import type {SeerAutomationHandoffConfiguration} from 'sentry/components/events/autofix/types';
import {organizationIntegrationsCodingAgents} from 'sentry/components/events/autofix/useAutofix';
import Placeholder from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {useQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

interface CodingAgentIntegrationCtaProps {
  project: Project;
}

interface AgentConfig {
  displayName: string;
  docsUrl: string;
  featureFlag: string;
  pluginId: string;
  provider: string;
  target: SeerAutomationHandoffConfiguration['target'];
  headingName?: string;
}

export function makeCodingAgentIntegrationCta(config: AgentConfig) {
  const headingLabel = config.headingName ?? config.displayName;

  return function CodingAgentIntegrationCta({project}: CodingAgentIntegrationCtaProps) {
    const organization = useOrganization();
    const user = useUser();

    const {preference, isFetching: isLoadingPreferences} =
      useProjectSeerPreferences(project);
    const {mutate: updateProjectSeerPreferences, isPending: isUpdatingPreferences} =
      useUpdateProjectSeerPreferences(project);
    const {data: codingAgentIntegrations, isLoading: isLoadingIntegrations} = useQuery(
      organizationIntegrationsCodingAgents(organization)
    );
    const {mutateAsync: updateProjectAutomation} = useUpdateProject(project);

    const integration = codingAgentIntegrations?.integrations.find(
      i => i.provider === config.provider
    );

    const hasFeatureFlag = organization.features.includes(config.featureFlag);
    const hasIntegration = Boolean(integration);
    const isAutomationEnabled =
      project.seerScannerAutomation !== false &&
      project.autofixAutomationTuning !== 'off';
    const isConfigured =
      preference?.automation_handoff?.target === config.target && isAutomationEnabled;

    const handleInstallClick = useCallback(() => {
      trackAnalytics('coding_integration.install_clicked', {
        organization,
        project_slug: project.slug,
        provider: config.provider,
        source: 'cta',
        user_id: user.id,
      });
    }, [organization, project.slug, user.id]);

    const handleSetupClick = useCallback(async () => {
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
        project.seerScannerAutomation === false ||
        project.autofixAutomationTuning === 'off';

      if (isAutomationDisabled) {
        await updateProjectAutomation({
          autofixAutomationTuning: 'low',
          seerScannerAutomation: true,
        });
      }

      updateProjectSeerPreferences({
        repositories: preference?.repositories || [],
        automated_run_stopping_point: 'root_cause',
        automation_handoff: {
          handoff_point: 'root_cause',
          target: config.target,
          integration_id: parseInt(integration.id, 10),
        },
      });
    }, [
      organization,
      project.slug,
      project.seerScannerAutomation,
      project.autofixAutomationTuning,
      updateProjectSeerPreferences,
      updateProjectAutomation,
      preference?.repositories,
      integration,
      user.id,
    ]);

    if (!hasFeatureFlag) {
      return null;
    }

    if (isLoadingPreferences || isLoadingIntegrations || isUpdatingPreferences) {
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
          <Flex direction="column" gap="lg">
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
                priority="default"
                size="sm"
                onClick={handleInstallClick}
              >
                {t('Install %s Integration', config.displayName)}
              </LinkButton>
            </div>
          </Flex>
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
          <Flex direction="column" gap="lg">
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
              <Button onClick={handleSetupClick} priority="default" size="sm">
                {t('Set Seer to hand off to %s', config.displayName)}
              </Button>
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
        </Flex>
      </Container>
    );
  };
}
