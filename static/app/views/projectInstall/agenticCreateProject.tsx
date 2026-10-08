import {Activity, useState} from 'react';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {Access} from 'sentry/components/acl/access';
import {AgenticSetup} from 'sentry/components/onboarding/agenticProgress/agenticSetup';
import type {AgentSetupCopySource} from 'sentry/components/onboarding/agenticProgress/agentSetupCard';
import type {AgenticRunSession} from 'sentry/components/onboarding/agenticProgress/types';
import {useAgenticSetupRun} from 'sentry/components/onboarding/agenticProgress/useAgenticSetupRun';
import {ManualSetupCard} from 'sentry/components/onboarding/manualSetupCard';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useCanCreateProject} from 'sentry/utils/useCanCreateProject';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

function getSetupHeading({
  hasRunFailed,
  isSetupComplete,
  isAgentConnected,
}: {
  hasRunFailed: boolean;
  isAgentConnected: boolean;
  isSetupComplete: boolean;
}) {
  if (hasRunFailed) {
    return {
      title: t('Setup Didn’t Finish'),
      description: t('Your agent ran into a problem. Try again or set up manually.'),
    };
  }

  if (isSetupComplete) {
    return {
      title: t('Your Projects Are Ready'),
      description: t('View your projects to explore what Sentry is capturing.'),
    };
  }

  if (isAgentConnected) {
    return {
      title: t('Your Agent Is Setting Up Sentry'),
      description: t('Keep your agent running and follow its setup progress here.'),
    };
  }

  return {
    title: t('Create a Project'),
    description: t(
      'Let your coding agent create projects, install the SDK, and verify that Sentry receives an error.'
    ),
  };
}

export function AgenticCreateProject({
  children,
}: {
  children: (agentSetupAction: React.ReactNode) => React.ReactNode;
}) {
  const organization = useOrganization();
  const canCreateProject = useCanCreateProject();
  const [session, setSession] = useState<AgenticRunSession>();
  const [setupMethod, setSetupMethod] = useState<'agent' | 'manual'>('agent');
  const [hasOpenedManualSetup, setHasOpenedManualSetup] = useState(false);
  const {
    run,
    onboardingCode,
    isAgentConnected,
    isSetupComplete,
    hasRunFailed,
    hasInitFailed,
    hasProgressFailed,
    refreshRun,
    restartRun,
  } = useAgenticSetupRun({
    enabled: canCreateProject && setupMethod === 'agent',
    session,
    onSessionChange: setSession,
  });

  const prompt = [
    t('Help me create and set up Sentry projects for this application.'),
    '',
    t('org slug: %s', organization.slug),
    ...(onboardingCode ? [t('run code: %s', onboardingCode)] : []),
  ].join('\n');

  const handleCopyCommand = (source: AgentSetupCopySource) => {
    trackAnalytics('project_creation.agent_setup_command_copied', {
      organization,
      variant: 'scm',
      source,
      run_id: run?.runId,
    });
  };

  const handleSelectSnippet = (source: AgentSetupCopySource) => {
    trackAnalytics('project_creation.agent_setup_snippet_selected', {
      organization,
      variant: 'scm',
      source,
      run_id: run?.runId,
    });
  };

  const heading = getSetupHeading({hasRunFailed, isSetupComplete, isAgentConnected});

  return (
    <SentryDocumentTitle title={t('Create a new project')}>
      <Access access={canCreateProject ? ['project:read'] : ['project:admin']}>
        <Activity mode={setupMethod === 'agent' ? 'visible' : 'hidden'}>
          <Stack padding="3xl" gap="2xl" align="center">
            <Stack maxWidth="700px" width="100%" gap="2xl">
              <Stack gap="md">
                <Heading as="h1">{heading.title}</Heading>
                <Text variant="secondary" density="comfortable">
                  {heading.description}
                </Text>
              </Stack>
              <AgenticSetup
                run={run}
                onboardingCode={onboardingCode}
                prompt={prompt}
                isAgentConnected={isAgentConnected}
                hasInitFailed={hasInitFailed}
                hasProgressFailed={hasProgressFailed}
                onRefresh={() => void refreshRun()}
                onRetry={restartRun}
                onCopyCommand={handleCopyCommand}
                onSelectSnippet={handleSelectSnippet}
                feedbackSource="project-creation-agent-setup"
                issueLinkReferrer="project-creation-agentic-first-issue"
                manualSetup={
                  <ManualSetupCard
                    onSetupInBrowser={() => {
                      trackAnalytics('project_creation.agent_setup_manual_clicked', {
                        organization,
                        variant: 'scm',
                        run_id: run?.runId,
                      });

                      setHasOpenedManualSetup(true);
                      setSetupMethod('manual');
                    }}
                  />
                }
              />
              {isSetupComplete && (
                <LinkButton
                  variant="primary"
                  to={makeProjectsPathname({organization, path: '/'})}
                  analyticsEventKey="project_creation.agent_setup_view_projects_clicked"
                  analyticsEventName="Project Creation: Agent Setup View Projects Clicked"
                  analyticsParams={{variant: 'scm', run_id: run?.runId}}
                >
                  {t('View projects')}
                </LinkButton>
              )}
            </Stack>
          </Stack>
        </Activity>
        {hasOpenedManualSetup && (
          <Activity mode={setupMethod === 'manual' ? 'visible' : 'hidden'}>
            {children(
              <Button
                icon={<IconArrow direction="left" />}
                analyticsEventKey="project_creation.agent_setup_return_clicked"
                analyticsEventName="Project Creation: Agent Setup Return Clicked"
                analyticsParams={{variant: 'scm', run_id: run?.runId}}
                onClick={() => setSetupMethod('agent')}
              >
                {t('Set up with your coding agent')}
              </Button>
            )}
          </Activity>
        )}
      </Access>
    </SentryDocumentTitle>
  );
}
