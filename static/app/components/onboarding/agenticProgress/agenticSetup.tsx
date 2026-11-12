import styled from '@emotion/styled';
import {IconChevron} from '@sentry/icons/chevron';
import {AnimatePresence, motion} from 'framer-motion';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ScmCollapsibleReveal} from 'sentry/components/onboarding/scm/scmCollapsibleReveal';
import {t, tct} from 'sentry/locale';

import {AgenticProgress} from './agenticProgressList';
import {AgentSetupCard, type AgentSetupCopySource} from './agentSetupCard';
import {SetupCardFrame} from './setupCardFrame';
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
  run: AgenticProgressRun | undefined;
  appearance?: 'default' | 'layered';
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
  feedbackSource,
  issueLinkReferrer,
  hasProgressFailed,
  onRefresh,
  run,
  appearance = 'default',
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
          {t('Could not prepare agent setup. Try again or set up manually.')}
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
              <SetupCardFrame layered={appearance === 'layered'}>
                <AgentSetupCard
                  feedbackSource={feedbackSource}
                  onCopyCommand={onCopyCommand}
                  onSelectSnippet={onSelectSnippet}
                  run={run}
                />
              </SetupCardFrame>
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
        <Container width="100%">
          {buttonProps => (
            <Button
              {...buttonProps}
              variant="transparent"
              onClick={onSetupInBrowser}
              data-test-id="onboarding-setup-in-browser"
            >
              <Flex as="span" align="center" gap="sm">
                <Text variant="secondary" bold={false}>
                  {tct('Prefer to do it yourself? [manual:Set up manually]', {
                    manual: <AccentText />,
                  })}
                </Text>
                <IconChevron direction="right" size="sm" variant="accent" />
              </Flex>
            </Button>
          )}
        </Container>
      </ScmCollapsibleReveal>
    </Stack>
  );
}

const AccentText = styled('span')`
  color: ${p => p.theme.tokens.content.accent};
`;
