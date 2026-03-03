import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {useUpdateProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import {CodingAgentProvider} from 'sentry/components/events/autofix/types';
import {organizationIntegrationsCodingAgents} from 'sentry/components/events/autofix/useAutofix';
import Placeholder from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {useQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

interface ClaudeCodeIntegrationCtaProps {
  project: Project;
}

export function ClaudeCodeIntegrationCta({project}: ClaudeCodeIntegrationCtaProps) {
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

  const claudeCodeIntegration = codingAgentIntegrations?.integrations.find(
    integration => integration.provider === 'claude_code'
  );

  const hasClaudeCodeIntegrationFeatureFlag = organization.features.includes(
    'integrations-claude-code'
  );
  const hasClaudeCodeIntegration = Boolean(claudeCodeIntegration);
  const isAutomationEnabled =
    project.seerScannerAutomation !== false && project.autofixAutomationTuning !== 'off';
  const isConfigured = Boolean(preference?.automation_handoff) && isAutomationEnabled;

  const handleInstallClick = useCallback(() => {
    trackAnalytics('coding_integration.install_clicked', {
      organization,
      project_slug: project.slug,
      provider: 'claude_code',
      source: 'cta',
      user_id: user.id,
    });
  }, [organization, project.slug, user.id]);

  const handleSetupClick = useCallback(async () => {
    if (!claudeCodeIntegration?.id) {
      throw new Error('Claude Agent integration not found');
    }

    trackAnalytics('coding_integration.setup_handoff_clicked', {
      organization,
      project_slug: project.slug,
      provider: 'claude_code',
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
        target: CodingAgentProvider.CLAUDE_CODE_AGENT,
        integration_id: parseInt(claudeCodeIntegration.id, 10),
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
    claudeCodeIntegration,
    user.id,
  ]);

  if (!hasClaudeCodeIntegrationFeatureFlag) {
    return null;
  }

  if (isLoadingPreferences || isLoadingIntegrations || isUpdatingPreferences) {
    return (
      <Card>
        <Placeholder height="120px" />
      </Card>
    );
  }

  // Stage 1: Integration not installed
  if (!hasClaudeCodeIntegration) {
    return (
      <Card>
        <Flex direction="column" gap="lg">
          <Heading as="h3">
            <Flex direction="row" gap="sm" align="center">
              <PluginIcon pluginId="claude_code" /> <span>Claude Agent Integration</span>
            </Flex>
          </Heading>
          <Text>
            {tct(
              'Connect Claude to automatically hand off Seer root cause analysis to Claude Agents for seamless code fixes. [docsLink:Read the docs] to learn more.',
              {
                docsLink: (
                  <ExternalLink href="https://docs.sentry.io/organization/integrations/claude-code/" />
                ),
              }
            )}
          </Text>
          <div>
            <LinkButton
              href={`/settings/${organization.slug}/integrations/claude_code/`}
              priority="default"
              size="sm"
              onClick={handleInstallClick}
            >
              {t('Install Claude Integration')}
            </LinkButton>
          </div>
        </Flex>
      </Card>
    );
  }

  // Stage 2: Integration installed but handoff not configured
  if (!isConfigured) {
    return (
      <Card>
        <Flex direction="column" gap="lg">
          <Heading as="h3">
            <Flex direction="row" gap="sm" align="center">
              <PluginIcon pluginId="claude_code" /> <span>Claude Agent Integration</span>
            </Flex>
          </Heading>
          <Text>
            {tct(
              'You have the Claude integration installed. Turn on Seer automation and set up hand off to trigger Claude Agents during automation. [seerProjectSettings:Configure in Seer project settings] or [docsLink:read the docs] to learn more.',
              {
                seerProjectSettings: (
                  <Link
                    to={`/settings/${organization.slug}/projects/${project.slug}/seer/`}
                  />
                ),
                docsLink: (
                  <ExternalLink href="https://docs.sentry.io/organization/integrations/claude-code/" />
                ),
              }
            )}
          </Text>
          <div>
            <Button onClick={handleSetupClick} priority="default" size="sm">
              {t('Set Seer to hand off to Claude')}
            </Button>
          </div>
        </Flex>
      </Card>
    );
  }

  // Stage 3: Configured
  return (
    <Card>
      <Flex direction="column" gap="lg">
        <Heading as="h3">
          <Flex direction="row" gap="sm" align="center">
            <PluginIcon pluginId="claude_code" /> <span>Claude Agent Integration</span>
          </Flex>
        </Heading>
        <Text>
          {tct(
            'Claude handoff is active. During automation runs, Seer will automatically trigger Claude Agents. [docsLink:Read the docs] to learn more.',
            {
              docsLink: (
                <ExternalLink href="https://docs.sentry.io/organization/integrations/claude-code/" />
              ),
            }
          )}
        </Text>
      </Flex>
    </Card>
  );
}

const Card = styled('div')`
  position: relative;
  padding: ${p => p.theme.space.xl};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  margin-top: ${p => p.theme.space['2xl']};
  margin-bottom: ${p => p.theme.space['2xl']};
`;
