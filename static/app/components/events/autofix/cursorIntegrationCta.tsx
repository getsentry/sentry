import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {Button} from 'sentry/components/core/button/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {useUpdateProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import {useCodingAgentIntegrations} from 'sentry/components/events/autofix/useAutofix';
import Placeholder from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {Project} from 'sentry/types/project';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import useOrganization from 'sentry/utils/useOrganization';

interface CursorIntegrationCtaProps {
  project: Project;
}

export function CursorIntegrationCta({project}: CursorIntegrationCtaProps) {
  const organization = useOrganization();

  const {preference, isFetching: isLoadingPreferences} =
    useProjectSeerPreferences(project);
  const {mutate: updateProjectSeerPreferences, isPending: isUpdatingPreferences} =
    useUpdateProjectSeerPreferences(project);
  const {data: codingAgentIntegrations, isLoading: isLoadingIntegrations} =
    useCodingAgentIntegrations();
  const {mutateAsync: updateProjectAutomation} = useUpdateProject(project);

  const cursorIntegration = codingAgentIntegrations?.integrations.find(
    integration => integration.provider === 'cursor'
  );

  const hasCursorIntegrationFeatureFlag =
    organization.features.includes('integrations-cursor');
  const hasCursorIntegration = Boolean(cursorIntegration);
  const isAutomationEnabled =
    project.seerScannerAutomation !== false && project.autofixAutomationTuning !== 'off';
  const isConfigured = Boolean(preference?.automation_handoff) && isAutomationEnabled;

  const handleSetupClick = useCallback(async () => {
    if (!cursorIntegration) {
      throw new Error('Cursor integration not found');
    }

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
        target: 'cursor_background_agent',
        integration_id: parseInt(cursorIntegration.id, 10),
      },
    });
  }, [
    project.seerScannerAutomation,
    project.autofixAutomationTuning,
    updateProjectSeerPreferences,
    updateProjectAutomation,
    preference?.repositories,
    cursorIntegration,
  ]);

  if (!hasCursorIntegrationFeatureFlag) {
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
  if (!hasCursorIntegration) {
    return (
      <Card>
        <Flex direction="column" gap="lg">
          <Heading as="h3">
            <Flex direction="row" gap="sm" align="center">
              <PluginIcon pluginId="cursor" /> <span>Cursor Agent Integration</span>
            </Flex>
          </Heading>
          <Text>
            {tct(
              'Connect Cursor to automatically hand off Seer root cause analysis to Cursor Cloud Agents for seamless code fixes. [docsLink:Read the docs] to learn more.',
              {
                docsLink: (
                  <ExternalLink href="https://docs.sentry.io/organization/integrations/cursor/" />
                ),
              }
            )}
          </Text>
          <div>
            <LinkButton
              href="/settings/integrations/cursor/"
              priority="default"
              size="sm"
            >
              {t('Install Cursor Integration')}
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
              <PluginIcon pluginId="cursor" /> <span>Cursor Agent Integration</span>
            </Flex>
          </Heading>
          <Text>
            {tct(
              'You have the Cursor integration installed. Turn on Seer automation and set up hand off to trigger Cursor Cloud Agents during automation. [seerProjectSettings:Configure in Seer project settings] or [docsLink:read the docs] to learn more.',
              {
                seerProjectSettings: (
                  <Link to={`/settings/projects/${project.slug}/seer/`} />
                ),
                docsLink: (
                  <ExternalLink href="https://docs.sentry.io/organization/integrations/cursor/" />
                ),
              }
            )}
          </Text>
          <div>
            <Button onClick={handleSetupClick} priority="default" size="sm">
              {t('Set Seer to hand off to Cursor')}
            </Button>
          </div>
        </Flex>
      </Card>
    );
  }

  // Stage 3: Configured or just configured
  return (
    <Card>
      <Flex direction="column" gap="lg">
        <Heading as="h3">
          <Flex direction="row" gap="sm" align="center">
            <PluginIcon pluginId="cursor" /> <span>Cursor Agent Integration</span>
          </Flex>
        </Heading>
        <Text>
          {tct(
            'Cursor handoff is active. During automation runs, Seer will automatically trigger Cursor Cloud Agents. [docsLink:Read the docs] to learn more.',
            {
              docsLink: (
                <ExternalLink href="https://docs.sentry.io/organization/integrations/cursor/" />
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
