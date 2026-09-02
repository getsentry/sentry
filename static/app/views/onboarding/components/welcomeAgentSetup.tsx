import {AnimatePresence, motion} from 'framer-motion';

import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ScmCollapsibleReveal} from 'sentry/components/onboarding/scm/scmCollapsibleReveal';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AgenticProgress} from 'sentry/views/onboarding/agenticProgress/agenticProgressList';
import type {AgenticProgressRun} from 'sentry/views/onboarding/agenticProgress/types';
import {useAgenticProgress} from 'sentry/views/onboarding/agenticProgress/useAgenticProgress';
import {useAgenticProgressInit} from 'sentry/views/onboarding/agenticProgress/useAgenticProgressInit';
import {
  AgentSetupCard,
  type AgentSetupCopySource,
} from 'sentry/views/onboarding/components/agentSetupCard';
import {ManualSetupCard} from 'sentry/views/onboarding/components/manualSetupCard';

const MotionContainer = motion.create(Container);

/**
 * Owns the welcome step's agentic run. useAgenticProgressInit keys its query on
 * a per-hook id until the onboarding context catches up, so exactly one caller
 * may run it — the step reads the run here and hands it down.
 */
export function useWelcomeAgentRun({enabled}: {enabled: boolean}) {
  const initialization = useAgenticProgressInit({enabled});
  const progress = useAgenticProgress({
    runId: initialization.data?.runId ?? null,
    enabled,
  });
  const liveRun = progress.data ?? initialization.data;
  const connectionStatus = liveRun?.stages.find(
    stage => stage.stage === 'connect_mcp'
  )?.status;
  const liveIsConnected = connectionStatus !== null && connectionStatus !== undefined;

  return {
    run: liveRun,
    onboardingCode: initialization.data?.onboardingCode,
    isAgentConnected: liveIsConnected,
    isSetupComplete: liveRun?.runStatus === 'completed',
  };
}

interface WelcomeAgentSetupProps {
  /**
   * Whether an agent has reported in. Drives the swap to the run's progress.
   */
  isAgentConnected: boolean;
  /**
   * Fired when a command is copied out of one of the code blocks.
   */
  onCopyCommand: (source: AgentSetupCopySource) => void;
  /**
   * Leaves the agent path and continues into the step-by-step browser flow.
   */
  onSetupInBrowser: () => void;
  /**
   * The step's agentic run, once initialization has returned one.
   */
  run: AgenticProgressRun | undefined;
  /**
   * The code the agent reports progress against, shown in the copied prompt.
   */
  onboardingCode?: string;
}

export function WelcomeAgentSetup({
  isAgentConnected,
  onboardingCode,
  onCopyCommand,
  onSetupInBrowser,
  run,
}: WelcomeAgentSetupProps) {
  const organization = useOrganization();
  // Once an agent reports in, the run's progress is the whole step. Offering the
  // manual path alongside it would be offering a choice already made.
  const showsProgress = Boolean(run) && isAgentConnected;
  // Built as separate lines rather than one sentence: the code block renders
  // with `white-space: pre-wrap`, so the breaks survive into what gets copied.
  const prompt = onboardingCode
    ? [
        t('Help me setup Sentry'),
        t('Org ID: %s', organization.slug),
        `[${onboardingCode}]`,
      ].join('\n')
    : t('Help me setup Sentry');

  return (
    <Stack gap="2xl" width="100%" position="relative" align="center">
      <AnimatePresence initial={false} mode="popLayout">
        {run && isAgentConnected ? (
          <MotionContainer
            key="progress"
            width="100%"
            initial={{opacity: 0, scale: 1.1}}
            animate={{opacity: 1, scale: 1}}
            exit={{opacity: 0, scale: 0.9}}
          >
            <AgenticProgress run={run} onboardingCode={onboardingCode} />
          </MotionContainer>
        ) : (
          <MotionContainer
            key="setup"
            width="100%"
            initial={{opacity: 0}}
            animate={{opacity: 1, scale: 1}}
            exit={{opacity: 0, scale: 0.9}}
          >
            <AgentSetupCard
              onboardingCode={onboardingCode}
              onCopyCommand={onCopyCommand}
              prompt={prompt}
            />
          </MotionContainer>
        )}
      </AnimatePresence>

      {/* Collapsing the height rather than just fading keeps the card above from
          jumping into the vacated space. */}
      <ScmCollapsibleReveal open={!showsProgress}>
        <Stack gap="2xl" align="center" width="100%">
          <Text variant="muted" size="md" bold uppercase>
            {t('or')}
          </Text>

          <ManualSetupCard onSetupInBrowser={onSetupInBrowser} />
        </Stack>
      </ScmCollapsibleReveal>
    </Stack>
  );
}
