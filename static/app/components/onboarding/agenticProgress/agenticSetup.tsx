import {IconChevron} from '@sentry/icons/chevron';
import {IconSliders} from '@sentry/icons/sliders';
import {AnimatePresence, motion} from 'framer-motion';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {ToggleCard} from '@sentry/scraps/toggleCard';

import {
  SETUP_CARD_ICON_SIZE,
  SETUP_CARD_MARKER_PX,
} from 'sentry/components/onboarding/consts';
import {ScmCollapsibleReveal} from 'sentry/components/onboarding/scm/scmCollapsibleReveal';
import {t} from 'sentry/locale';

import {AgenticProgress} from './agenticProgressList';
import {AgentSetupCard, type AgentSetupCopySource} from './agentSetupCard';
import type {AgenticProgressRun} from './types';

const MotionContainer = motion.create(Container);
const CARD_MORPH_TRANSITION = {duration: 0.25, ease: 'easeOut'} as const;

interface AgenticSetupProps {
  feedbackSource: string;
  hasInitFailed: boolean;
  hasProgressFailed: boolean;
  isAgentConnected: boolean;
  issueLinkReferrer: string;
  onCopyCommand: (source: AgentSetupCopySource) => void;
  onRefresh: () => void;
  onRetry: () => void;
  onSelectSnippet: (source: AgentSetupCopySource) => void;
  /** The host supplies the action for continuing with browser setup. */
  onSetupInBrowser: () => void;
  prompt: string;
  run: AgenticProgressRun | undefined;
  onboardingCode?: string;
}

export function AgenticSetup({
  hasInitFailed,
  isAgentConnected,
  onboardingCode,
  onCopyCommand,
  onRetry,
  onSelectSnippet,
  onSetupInBrowser,
  prompt,
  feedbackSource,
  issueLinkReferrer,
  hasProgressFailed,
  onRefresh,
  run,
}: AgenticSetupProps) {
  const hasRunFailed = run?.runStatus === 'failed' || run?.runStatus === 'cancelled';
  const showsProgress =
    Boolean(run) && (isAgentConnected || run?.runStatus === 'completed' || hasRunFailed);

  return (
    <Stack gap="2xl" width="100%" position="relative" align="center">
      <ScmCollapsibleReveal open={hasInitFailed}>
        <Alert
          variant="danger"
          showIcon
          trailingItems={
            <Button size="xs" onClick={onRetry}>
              {t('Try again')}
            </Button>
          }
        >
          {t('Could not start setup, so the prompt below will not report progress.')}
        </Alert>
      </ScmCollapsibleReveal>

      <ScmCollapsibleReveal open={hasProgressFailed}>
        <Alert
          variant="warning"
          showIcon
          trailingItems={
            <Button size="xs" onClick={onRefresh}>
              {t('Refresh progress')}
            </Button>
          }
        >
          {t(
            'Could not refresh setup progress. Your agent can continue working. Try refreshing progress.'
          )}
        </Alert>
      </ScmCollapsibleReveal>

      <MotionContainer
        layout
        width="100%"
        position="relative"
        transition={CARD_MORPH_TRANSITION}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {run && showsProgress ? (
            <MotionContainer
              key="progress"
              layout="position"
              width="100%"
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              exit={{opacity: 0}}
              transition={CARD_MORPH_TRANSITION}
            >
              <AgenticProgress
                run={run}
                onboardingCode={onboardingCode}
                issueLinkReferrer={issueLinkReferrer}
              />
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
                feedbackSource={feedbackSource}
                hasSetupFailed={hasInitFailed}
                onboardingCode={onboardingCode}
                onCopyCommand={onCopyCommand}
                onSelectSnippet={onSelectSnippet}
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
          <Text variant="muted" size="md" bold>
            {t('or')}
          </Text>

          <ToggleCard
            variant="button"
            onClick={onSetupInBrowser}
            data-test-id="onboarding-setup-in-browser"
          >
            <Grid
              columns={`${SETUP_CARD_MARKER_PX} 1fr max-content`}
              gap="0 md"
              width="100%"
              areas={`
          "icon title chevron"
          ".    body  body"
        `}
            >
              <Flex area="icon" align="center" justify="center">
                <IconSliders size={SETUP_CARD_ICON_SIZE} variant="secondary" />
              </Flex>
              <Flex area="title" align="center">
                <Text bold size="lg">
                  {t('Set up manually')}
                </Text>
              </Flex>
              <Flex area="chevron" align="center">
                <IconChevron
                  direction="right"
                  size={SETUP_CARD_ICON_SIZE}
                  variant="secondary"
                />
              </Flex>
              <Container area="body" paddingTop="xs">
                <Text variant="muted" size="md" density="comfortable" textWrap="pretty">
                  {t(
                    'Connect a repo, choose what to instrument and where alerts land, then follow the instructions for your project'
                  )}
                </Text>
              </Container>
            </Grid>
          </ToggleCard>
        </Stack>
      </ScmCollapsibleReveal>
    </Stack>
  );
}
