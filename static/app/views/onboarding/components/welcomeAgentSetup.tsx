import {AnimatePresence, motion} from 'framer-motion';

import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AgenticProgress} from 'sentry/views/onboarding/agenticProgress/agenticProgressList';
import {useAgenticProgress} from 'sentry/views/onboarding/agenticProgress/useAgenticProgress';
import {useAgenticProgressInit} from 'sentry/views/onboarding/agenticProgress/useAgenticProgressInit';
import {
  AgentSetupCard,
  type AgentSetupCopySource,
} from 'sentry/views/onboarding/components/agentSetupCard';
import {ManualSetupCard} from 'sentry/views/onboarding/components/manualSetupCard';

const MotionContainer = motion.create(Container);

interface WelcomeAgentSetupProps {
  /**
   * Fired when a command is copied out of one of the code blocks.
   */
  onCopyCommand: (source: AgentSetupCopySource) => void;
  /**
   * Leaves the agent path and continues into the step-by-step browser flow.
   */
  onSetupInBrowser: () => void;
}

export function WelcomeAgentSetup({
  onCopyCommand,
  onSetupInBrowser,
}: WelcomeAgentSetupProps) {
  const organization = useOrganization();
  const initialization = useAgenticProgressInit({enabled: true});
  const progress = useAgenticProgress({runId: initialization.data?.runId ?? null});
  const run = progress.data ?? initialization.data;
  const connectionStatus = run?.stages.find(
    stage => stage.stage === 'connect_mcp'
  )?.status;
  const isAgentConnected = connectionStatus !== null && connectionStatus !== undefined;
  // Built as separate lines rather than one sentence: the code block renders
  // with `white-space: pre-wrap`, so the breaks survive into what gets copied.
  const prompt = initialization.data?.onboardingCode
    ? [
        t('Help me setup Sentry'),
        t('Org ID: %s', organization.slug),
        `[${initialization.data.onboardingCode}]`,
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
            <AgenticProgress
              run={run}
              onboardingCode={initialization.data?.onboardingCode}
            />
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
              onboardingCode={initialization.data?.onboardingCode}
              onCopyCommand={onCopyCommand}
              prompt={prompt}
            />
          </MotionContainer>
        )}
      </AnimatePresence>

      <Text variant="muted" size="md" bold uppercase>
        {t('or')}
      </Text>

      <ManualSetupCard onSetupInBrowser={onSetupInBrowser} />
    </Stack>
  );
}
