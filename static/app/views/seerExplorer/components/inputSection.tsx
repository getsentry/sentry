import {useEffect} from 'react';
import styled from '@emotion/styled';
import {IconArrow} from '@sentry/icons/arrow';
import {IconPause} from '@sentry/icons/pause';
import {motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Composer, type ComposerValue} from '@sentry/scraps/composer';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {RepoPRState, SeerExplorerRunId} from 'sentry/views/seerExplorer/types';

import {PRLinksBar} from './prLinksBar';

interface FileApprovalActions {
  currentIndex: number;
  onApprove: () => void;
  onReject: () => void;
  totalPatches: number;
}

interface QuestionActions {
  canSubmit: boolean;
  currentIndex: number;
  onBack: () => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onNext: () => void;
  totalQuestions: number;
}

interface InputSectionProps {
  composerRef: React.RefObject<HTMLDivElement | null>;
  enabled: boolean;
  inputValue: ComposerValue;
  onInputChange: (value: ComposerValue) => void;
  onInputClick: () => void;
  onInterrupt: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onSend: () => void;
  repoPRStates: Record<string, RepoPRState>;
  canSendMessage?: boolean;
  /** Placeholder shown while `enabled` is false. Defaults to the read-only copy. */
  disabledPlaceholder?: string;
  fileApprovalActions?: FileApprovalActions;
  interruptState?: 'can-interrupt' | 'requested' | 'completed' | 'disabled';
  isSingleRun?: boolean;
  /** Shown right above the composer, for example to say why sending is blocked. */
  notice?: React.ReactNode;
  questionActions?: QuestionActions;
  runId?: SeerExplorerRunId | null;
  /**
   * Shown in the toolbar under the editor, before the send or interrupt button.
   * The chat puts the organization's credit usage here.
   */
  toolbarItems?: React.ReactNode;
}

export function InputSection({
  enabled,
  inputValue,
  canSendMessage = true,
  disabledPlaceholder,
  interruptState = 'disabled',
  onInputChange,
  onInputClick,
  onInterrupt,
  onKeyDown,
  onSend,
  repoPRStates,
  composerRef,
  fileApprovalActions,
  notice,
  questionActions,
  runId,
  isSingleRun,
  toolbarItems,
}: InputSectionProps) {
  const organization = useOrganization({allowNull: true});
  // Autofix single runs and ask-seer-create-pr runs open PRs, so show links to them.
  const agentCreatesPRs =
    isSingleRun || organization?.features.includes('ask-seer-create-pr');
  // Keyed by run so collapse state resets when switching conversations.
  const prLinksBar = agentCreatesPRs ? (
    <PRLinksBar key={runId ?? undefined} repoPRStates={repoPRStates} />
  ) : null;

  // Handle keyboard shortcuts for file approval
  useEffect(() => {
    if (!enabled || !fileApprovalActions) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        fileApprovalActions.onApprove();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        fileApprovalActions.onReject();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, fileApprovalActions]);

  // Handle keyboard shortcuts for questions
  useEffect(() => {
    if (!enabled || !questionActions) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in the custom text input
      const isTypingInCustomInput = e.target instanceof HTMLInputElement;

      if (e.key === 'ArrowUp') {
        // Always allow ArrowUp to move selection (exits custom input back to options)
        e.preventDefault();
        questionActions.onMoveUp();
      } else if (e.key === 'ArrowDown' && !isTypingInCustomInput) {
        // Only allow ArrowDown when not in custom input (nowhere to go down from "Other")
        e.preventDefault();
        questionActions.onMoveDown();
      } else if (e.key === 'Enter') {
        // Submit on Enter
        if (questionActions.canSubmit) {
          e.preventDefault();
          questionActions.onNext();
        }
      } else if (
        (e.key === 'Backspace' || e.key === 'Delete') &&
        !isTypingInCustomInput
      ) {
        // Go back on Backspace/Delete when not typing
        if (questionActions.currentIndex > 0) {
          e.preventDefault();
          questionActions.onBack();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, questionActions]);

  // Render disabled input element if not enabled
  if (!enabled) {
    return (
      <Container background="primary" width="100%" position="sticky" bottom="0">
        {prLinksBar}
        <Flex align="end" margin="lg xl" gap="sm">
          <StyledInputGroup>
            <InputGroup.TextArea
              disabled
              placeholder={
                disabledPlaceholder ??
                t('This conversation is owned by another user and is read-only')
              }
              rows={1}
              size="md"
              data-test-id="seer-explorer-input"
            />
          </StyledInputGroup>
        </Flex>
      </Container>
    );
  }

  // Render file approval action bar instead of entire input section
  if (fileApprovalActions) {
    const {currentIndex, totalPatches, onApprove, onReject} = fileApprovalActions;
    const hasMultiple = totalPatches > 1;

    return (
      <ActionBar
        initial={{opacity: 0, y: 10}}
        animate={{opacity: 1, y: 0}}
        exit={{opacity: 0, y: 10}}
        transition={{duration: 0.12, delay: 0.1, ease: 'easeOut'}}
      >
        <Container borderTop="primary" padding="md" background="secondary">
          <Flex justify="between" align="center">
            <Flex align="center" gap="md" paddingLeft="md">
              <Text size="md" bold>
                {t('Make this change?')}
              </Text>
              {hasMultiple && (
                <Text size="md" variant="muted">
                  {t('(%s of %s)', currentIndex + 1, totalPatches)}
                </Text>
              )}
            </Flex>
            <Grid flow="column" align="center" gap="md">
              <Button size="md" onClick={onReject}>
                {t('Reject')} <Kbd>esc</Kbd>
              </Button>
              <Button size="md" variant="primary" onClick={onApprove}>
                {t('Approve')} <Kbd>↵</Kbd>
              </Button>
            </Grid>
          </Flex>
        </Container>
      </ActionBar>
    );
  }

  // Render question action bar
  if (questionActions) {
    const {
      currentIndex,
      totalQuestions,
      onBack,
      onNext,
      canSubmit: canSubmitQuestion,
    } = questionActions;
    const hasMultiple = totalQuestions > 1;
    const isLastQuestion = currentIndex >= totalQuestions - 1;

    return (
      <ActionBar
        initial={{opacity: 0, y: 10}}
        animate={{opacity: 1, y: 0}}
        exit={{opacity: 0, y: 10}}
        transition={{duration: 0.12, delay: 0.1, ease: 'easeOut'}}
      >
        <Container borderTop="primary" padding="md" background="secondary">
          <Flex justify="between" align="center">
            <Flex align="center" gap="md" paddingLeft="md">
              <Text size="md" bold>
                {t('Asking some questions...')}
              </Text>
              {hasMultiple && (
                <Text size="md" variant="muted">
                  {t('(%s of %s)', currentIndex + 1, totalQuestions)}
                </Text>
              )}
            </Flex>
            <Grid flow="column" align="center" gap="md">
              {currentIndex > 0 && (
                <Button size="md" onClick={onBack}>
                  {t('Back')} ⌫
                </Button>
              )}
              <Button
                size="md"
                variant="primary"
                onClick={onNext}
                disabled={!canSubmitQuestion}
              >
                {isLastQuestion ? t('Submit') : t('Next')} ⏎
              </Button>
            </Grid>
          </Flex>
        </Container>
      </ActionBar>
    );
  }

  return (
    <Container background="primary" width="100%" position="sticky" bottom="0">
      {prLinksBar}
      <Stack gap="lg" padding="lg xl">
        {notice}
        {/* The editor and its toolbar read as one field, so the focus ring wraps both. */}
        <ComposerFrame border="primary" radius="lg">
          <StyledComposer
            isWarningPlaceholder={interruptState === 'completed'}
            ref={composerRef}
            aria-label={t('Ask Seer a question')}
            plugins={[]}
            value={inputValue}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            onClick={onInputClick}
            placeholder={
              interruptState === 'completed'
                ? t('Interrupted. What should Seer do instead?')
                : t('Ask Seer a question, or press / for commands.')
            }
            minHeight={60}
            size="md"
            data-test-id="seer-explorer-input"
          />
          <Flex
            justify="end"
            align="center"
            gap="md"
            padding="xs"
            borderTop="primary"
            background="primary"
            radius="0 0 lg lg"
          >
            {toolbarItems}
            {interruptState === 'can-interrupt' || interruptState === 'requested' ? (
              <Button
                icon={<IconPause />}
                onClick={onInterrupt}
                size="zero"
                variant="primary"
                disabled={interruptState === 'requested'}
                aria-label={t('Interrupt button')}
                tooltipProps={{
                  title:
                    interruptState === 'requested'
                      ? t('Winding down...')
                      : t('Interrupt'),
                }}
              />
            ) : (
              <Button
                icon={<IconArrow />}
                onClick={onSend}
                size="zero"
                variant="secondary"
                disabled={!canSendMessage}
                aria-label={t('Send message')}
              />
            )}
          </Flex>
        </ComposerFrame>
      </Stack>
    </Container>
  );
}

const ComposerFrame = styled(Stack)`
  transition: box-shadow ${p => p.theme.motion.smooth.fast};

  &:focus-within {
    ${p => p.theme.focusRing()};
  }
`;

const StyledComposer = styled(Composer, {
  shouldForwardProp: prop => prop !== 'isWarningPlaceholder',
})<{isWarningPlaceholder: boolean}>`
  max-height: 120px;
  /* The frame draws the border and the focus ring around the editor and toolbar. */
  border: none;
  border-radius: ${p => p.theme.radius.lg} ${p => p.theme.radius.lg} 0 0;

  &:focus,
  &:focus-visible {
    box-shadow: 0 1px 0 0 ${p => p.theme.tokens.interactive.chonky.debossed.neutral.chonk}
      inset;
  }

  &:empty::before {
    color: ${p =>
      p.isWarningPlaceholder
        ? p.theme.tokens.content.warning
        : p.theme.tokens.content.secondary};
  }
`;

// Styled components

const StyledInputGroup = styled(InputGroup)`
  flex: 1;

  textarea {
    resize: none;
  }

  [data-test-id='input-trailing-items'] {
    right: ${p => p.theme.space.xs};
  }
`;

const ActionBar = styled(motion.div)`
  flex-shrink: 0;
  width: 100%;
  background: ${p => p.theme.tokens.background.primary};
  position: sticky;
  bottom: 0;
`;

const Kbd = styled('span')`
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.xs};
  margin-left: ${p => p.theme.space.xs};
`;
