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
 * Shared by the card swap so the box resizing and the contents cross-fading
 * finish together, which is what sells them as one card rather than two.
 */
const CARD_MORPH_TRANSITION = {duration: 0.25, ease: 'easeOut'} as const;

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
  // A failed connection is a report, but not a connection. Every other status
  // means the agent reached us: connect_mcp is not optional, so it is never
  // skipped, and the backend infers `bypassed` from later stages arriving.
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
  // manual path alongside it would be offering a choice already made — until the
  // run fails, at which point the choice is open again and the step needs a way
  // forward. The progress stays up either way, since it shows what went wrong.
  const showsProgress = Boolean(run) && isAgentConnected;
  const hasRunFailed = run?.runStatus === 'failed' || run?.runStatus === 'cancelled';
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
      {/* Both states occupy one slot inside a box that animates its own height,
          so the setup card grows into the progress list instead of being
          swapped for it. popLayout lifts the outgoing card out of flow, letting
          the incoming one take the slot while the two cross-fade in place —
          their borders line up, so what reads is a single card changing. */}
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

      {/* Collapsing the height rather than just fading keeps the card above from
          jumping into the vacated space. */}
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
