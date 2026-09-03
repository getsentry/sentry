import {AnimatePresence, motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ScmCollapsibleReveal} from 'sentry/components/onboarding/scm/scmCollapsibleReveal';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AgenticProgress} from 'sentry/views/onboarding/agenticProgress/agenticProgressList';
import type {AgenticProgressRun} from 'sentry/views/onboarding/agenticProgress/types';
import {useAgenticProgress} from 'sentry/views/onboarding/agenticProgress/useAgenticProgress';
import {
  useAgenticProgressInit,
  useRestartAgenticRun,
} from 'sentry/views/onboarding/agenticProgress/useAgenticProgressInit';
import {
  AgentSetupCard,
  type AgentSetupCopySource,
} from 'sentry/views/onboarding/components/agentSetupCard';
import {ManualSetupCard} from 'sentry/views/onboarding/components/manualSetupCard';

const MotionContainer = motion.create(Container);

const CARD_MORPH_TRANSITION = {duration: 0.25, ease: 'easeOut'} as const;

export function useWelcomeAgentRun({enabled}: {enabled: boolean}) {
  const initialization = useAgenticProgressInit({enabled});
  const restartRun = useRestartAgenticRun();
  const progress = useAgenticProgress({
    runId: initialization.data?.runId ?? null,
    enabled,
  });
  const liveRun = progress.data ?? initialization.data;
  const connectionStatus = liveRun?.stages.find(
    stage => stage.stage === 'connect_mcp'
  )?.status;
  const liveIsConnected =
    connectionStatus !== null &&
    connectionStatus !== undefined &&
    connectionStatus !== 'failed';

  return {
    run: liveRun,
    onboardingCode: initialization.data?.onboardingCode,
    isAgentConnected: liveIsConnected,
    isSetupComplete: liveRun?.runStatus === 'completed',
    hasRunFailed: liveRun?.runStatus === 'failed' || liveRun?.runStatus === 'cancelled',
    restartRun,
  };
}

interface WelcomeAgentSetupProps {
  isAgentConnected: boolean;
  /**
   * Fired when a command is copied out of one of the code blocks.
   */
  onCopyCommand: (source: AgentSetupCopySource) => void;
  onRetry: () => void;
  /**
   * Leaves the agent path and continues into the step-by-step browser flow.
   */
  onSetupInBrowser: () => void;
  run: AgenticProgressRun | undefined;
  onboardingCode?: string;
}

export function WelcomeAgentSetup({
  isAgentConnected,
  onboardingCode,
  onCopyCommand,
  onRetry,
  onSetupInBrowser,
  run,
}: WelcomeAgentSetupProps) {
  const organization = useOrganization();
  const showsProgress = Boolean(run) && isAgentConnected;
  const hasRunFailed = run?.runStatus === 'failed' || run?.runStatus === 'cancelled';
  const prompt = onboardingCode
    ? [
        t('Help me setup Sentry'),
        t('Org ID: %s', organization.slug),
        `[${onboardingCode}]`,
      ].join('\n')
    : t('Help me setup Sentry');

  return (
    <Stack gap="2xl" width="100%" position="relative" align="center">
      <MotionContainer
        layout
        width="100%"
        position="relative"
        transition={CARD_MORPH_TRANSITION}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {run && isAgentConnected ? (
            <MotionContainer
              key="progress"
              layout="position"
              width="100%"
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              exit={{opacity: 0}}
              transition={CARD_MORPH_TRANSITION}
            >
              <AgenticProgress run={run} onboardingCode={onboardingCode} />
            </MotionContainer>
          ) : (
            <MotionContainer
              key="setup"
              layout="position"
              width="100%"
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              exit={{opacity: 0}}
              transition={CARD_MORPH_TRANSITION}
            >
              <AgentSetupCard
                onboardingCode={onboardingCode}
                onCopyCommand={onCopyCommand}
                prompt={prompt}
              />
            </MotionContainer>
          )}
        </AnimatePresence>
      </MotionContainer>

      <ScmCollapsibleReveal open={hasRunFailed}>
        <Button variant="primary" onClick={onRetry}>
          {t('Try again')}
        </Button>
      </ScmCollapsibleReveal>

      <ScmCollapsibleReveal open={!showsProgress || hasRunFailed}>
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
