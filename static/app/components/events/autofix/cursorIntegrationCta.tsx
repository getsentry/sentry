import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {useQueryClient} from '@tanstack/react-query';

import {Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {Button} from 'sentry/components/core/button/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {
  makeProjectSeerPreferencesQueryKey,
  useProjectSeerPreferences,
} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {useUpdateProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import {useCodingAgentIntegrations} from 'sentry/components/events/autofix/useAutofix';
import Placeholder from 'sentry/components/placeholder';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';

interface CursorIntegrationCtaProps {
  project: Project;
  dismissKey?: string;
  dismissible?: boolean;
  organization?: Organization;
}

export function CursorIntegrationCta({
  project,
  dismissible = false,
  dismissKey,
}: CursorIntegrationCtaProps) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const {preference, isFetching: isLoadingPreferences} =
    useProjectSeerPreferences(project);
  const {mutate: updateProjectSeerPreferences, isPending: isUpdatingPreferences} =
    useUpdateProjectSeerPreferences(project);
  const {data: codingAgentIntegrations, isLoading: isLoadingIntegrations} =
    useCodingAgentIntegrations();

  const cursorIntegration = codingAgentIntegrations?.integrations.find(
    integration => integration.provider === 'cursor'
  );

  const [isDismissed, setIsDismissed] = useState(() => {
    if (!dismissible || !dismissKey) {
      return false;
    }
    return localStorage.getItem(dismissKey) === 'true';
  });

  const hasCursorIntegrationFeatureFlag =
    organization?.features.includes('integrations-cursor');
  const hasCursorIntegration = Boolean(cursorIntegration);
  const isConfigured = Boolean(preference?.automation_handoff);

  // Determine the current stage
  const stage = hasCursorIntegration
    ? isConfigured
      ? 'configured'
      : 'configure'
    : 'install';

  // Reset dismissal if stage changes
  useEffect(() => {
    if (!dismissible || !dismissKey) {
      return;
    }
    const dismissedStage = localStorage.getItem(`${dismissKey}-stage`);
    if (dismissedStage && dismissedStage !== stage) {
      setIsDismissed(false);
      localStorage.removeItem(dismissKey);
    }
  }, [stage, dismissKey, dismissible]);

  const handleDismiss = useCallback(() => {
    if (!dismissKey) {
      return;
    }
    localStorage.setItem(dismissKey, 'true');
    localStorage.setItem(`${dismissKey}-stage`, stage);
    setIsDismissed(true);
  }, [dismissKey, stage]);

  const handleSetupClick = useCallback(() => {
    if (!cursorIntegration) {
      throw new Error('Cursor integration not found');
    }
    updateProjectSeerPreferences(
      {
        repositories: preference?.repositories || [],
        automated_run_stopping_point: 'root_cause',
        automation_handoff: {
          handoff_point: 'root_cause',
          target: 'cursor_background_agent',
          integration_id: parseInt(cursorIntegration.id, 10),
        },
      },
      {
        onSuccess: () => {
          // Invalidate queries to update the dropdown in the settings page
          queryClient.invalidateQueries({
            queryKey: [
              makeProjectSeerPreferencesQueryKey(organization.slug, project.slug),
            ],
          });
        },
      }
    );
  }, [
    project.slug,
    organization.slug,
    updateProjectSeerPreferences,
    preference?.repositories,
    cursorIntegration,
    queryClient,
  ]);

  if (!organization) {
    return null;
  }

  if (isDismissed) {
    return null;
  }

  if (!hasCursorIntegrationFeatureFlag) {
    return null;
  }

  // Show loading state while fetching data
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
        {dismissible && (
          <DismissButton
            size="xs"
            priority="link"
            icon={<IconClose />}
            aria-label={t('Dismiss')}
            onClick={handleDismiss}
          />
        )}

        <Flex direction="column" gap="lg">
          <Heading as="h3">
            <Flex direction="row" gap="sm" align="center">
              <PluginIcon pluginId="cursor" /> <span>Cursor Agent Integration</span>
            </Flex>
          </Heading>
          <Text>
            {tct(
              'Connect Cursor to automatically hand off Seer root cause analysis to Cursor Background Agents for seamless code fixes. [docsLink:Read the docs] to learn more.',
              {
                docsLink: (
                  <ExternalLink href="https://docs.sentry.io/integrations/cursor/" />
                ),
              }
            )}
          </Text>
          <div>
            <LinkButton to="/settings/integrations/cursor/" priority="default" size="sm">
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
        {dismissible && (
          <DismissButton
            size="xs"
            priority="link"
            icon={<IconClose />}
            aria-label={t('Dismiss')}
            onClick={handleDismiss}
          />
        )}

        <Flex direction="column" gap="lg">
          <Heading as="h3">
            <Flex direction="row" gap="sm" align="center">
              <PluginIcon pluginId="cursor" /> <span>Cursor Agent Integration</span>
            </Flex>
          </Heading>
          <Text>
            {tct(
              'You have the Cursor integration installed. Set up Seer to hand off and trigger Cursor Background Agents during automation. [seerProjectSettings:Configure in Seer project settings] or [docsLink:read the docs] to learn more.',
              {
                seerProjectSettings: (
                  <Link to={`/settings/projects/${project.slug}/seer/`} />
                ),
                docsLink: (
                  <ExternalLink href="https://docs.sentry.io/integrations/cursor/" />
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
      {dismissible && (
        <DismissButton
          size="xs"
          priority="link"
          icon={<IconClose />}
          aria-label={t('Dismiss')}
          onClick={handleDismiss}
        />
      )}

      <Flex direction="column" gap="lg">
        <Heading as="h3">
          <Flex direction="row" gap="sm" align="center">
            <PluginIcon pluginId="cursor" /> <span>Cursor Agent Integration</span>
          </Flex>
        </Heading>
        <Text>
          {tct(
            'Cursor handoff is active. During automation runs, Seer will automatically trigger Cursor Background Agents. [docsLink:Read the docs] to learn more.',
            {
              docsLink: (
                <ExternalLink href="https://docs.sentry.io/integrations/cursor/" />
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
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  margin-top: ${p => p.theme.space['2xl']};
  margin-bottom: ${p => p.theme.space['2xl']};
`;

const DismissButton = styled(Button)`
  position: absolute;
  top: ${p => p.theme.space.md};
  right: ${p => p.theme.space.md};
  color: ${p => p.theme.subText};

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;
