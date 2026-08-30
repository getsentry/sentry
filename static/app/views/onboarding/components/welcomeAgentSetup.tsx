import {AnimatePresence, motion} from 'framer-motion';

import {Container, Grid} from '@sentry/scraps/layout';
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
  const prompt = initialization.data?.onboardingCode
    ? t(
        'Help me setup sentry for my organization %s [%s]',
        organization.slug,
        initialization.data.onboardingCode
      )
    : t('Help me setup Sentry');

  return (
    <Grid
      columns={{'screen:xs': '1fr', 'screen:md': 'repeat(2, 1fr)'}}
      gap="2xl"
      width="100%"
      align="stretch"
      position="relative"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {run && isAgentConnected ? (
          <MotionContainer
            key="progress"
            width="100%"
            alignSelf="start"
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
            height="100%"
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

      <Grid
        columns={{'screen:xs': '1fr', 'screen:md': 'max-content 1fr'}}
        gap="2xl"
        align="stretch"
      >
        <Grid
          columns={{'screen:xs': '1fr max-content 1fr', 'screen:md': 'none'}}
          rows={{'screen:xs': 'none', 'screen:md': '1fr max-content 1fr'}}
          align={{'screen:xs': 'center', 'screen:md': 'stretch'}}
          justifyItems={{'screen:xs': 'stretch', 'screen:md': 'center'}}
          gap="md"
        >
          <SeparatorRule />
          <Text variant="muted" size="sm" bold uppercase>
            {t('or')}
          </Text>
          <SeparatorRule />
        </Grid>

        <ManualSetupCard
          isAgentConnected={isAgentConnected}
          onSetupInBrowser={onSetupInBrowser}
        />
      </Grid>
    </Grid>
  );
}

/**
 * One of the two rules flanking the "or" label. It draws as a horizontal line
 * while the two setup paths stack, and turns vertical once they sit side by
 * side. The grid stretches it along the line's axis and centers it on the
 * other, so a single border edge is all the rule needs.
 */
function SeparatorRule() {
  return (
    <Container
      borderTop={{'screen:xs': 'secondary', 'screen:md': 'none'}}
      borderLeft={{'screen:xs': 'none', 'screen:md': 'secondary'}}
    />
  );
}
