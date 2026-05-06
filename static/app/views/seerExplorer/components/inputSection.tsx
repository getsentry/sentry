import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconArrow, IconPause} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PRWidget} from 'sentry/views/seerExplorer/components/prWidget';
import type {Block, RepoPRState} from 'sentry/views/seerExplorer/types';

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
  blocks: Block[];
  canInterrupt: boolean;
  enabled: boolean;
  inputValue: string;
  onClear: () => void;
  onCreatePR: (repoName?: string) => void;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onInputClick: () => void;
  onInterrupt: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPRWidgetClick: () => void;
  onSend: () => void;
  prWidgetButtonRef: React.RefObject<HTMLButtonElement | null>;
  repoPRStates: Record<string, RepoPRState>;
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
  waitingForInterrupt: boolean;
  fileApprovalActions?: FileApprovalActions;
  isMinimized?: boolean;
  isVisible?: boolean;
  questionActions?: QuestionActions;
}

export function InputSection({
  blocks,
  enabled,
  inputValue,
  isMinimized = false,
  canInterrupt,
  waitingForInterrupt,
  isVisible = false,
  onCreatePR,
  onInputChange,
  onInputClick,
  onInterrupt,
  onKeyDown,
  onPRWidgetClick,
  onSend,
  prWidgetButtonRef,
  repoPRStates,
  textAreaRef,
  fileApprovalActions,
  questionActions,
}: InputSectionProps) {
  // Check if there are any file patches for showing the PR widget
  const hasCodeChanges = useMemo(() => {
    return blocks.some(b => b.merged_file_patches && b.merged_file_patches.length > 0);
  }, [blocks]);

  // Handle keyboard shortcuts for file approval
  useEffect(() => {
    if (!enabled || !fileApprovalActions || !isVisible || isMinimized) {
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
  }, [enabled, fileApprovalActions, isVisible, isMinimized]);

  // Handle keyboard shortcuts for questions
  useEffect(() => {
    if (!enabled || !questionActions || !isVisible || isMinimized) {
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
  }, [enabled, questionActions, isVisible, isMinimized]);

  // Render disabled input element if not enabled
  if (!enabled) {
    return (
      <InputBlock>
        <InputRow>
          <StyledInputGroup>
            <InputGroup.TextArea
              disabled
              placeholder={t(
                'This conversation is owned by another user and is read-only'
              )}
              rows={1}
              size="md"
              data-test-id="seer-explorer-input"
            />
          </StyledInputGroup>
        </InputRow>
      </InputBlock>
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
    <InputBlock>
      <InputRow>
        <StyledInputGroup>
          <InputGroup.TextArea
            ref={textAreaRef}
            value={inputValue}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            onClick={onInputClick}
            placeholder={t('Ask Seer a question, or press / for commands.')}
            rows={1}
            maxRows={5}
            autosize
            size="md"
            data-test-id="seer-explorer-input"
          />
        </StyledInputGroup>
        {canInterrupt || waitingForInterrupt ? (
          <Button
            icon={<IconPause />}
            onClick={onInterrupt}
            size="md"
            variant="primary"
            disabled={waitingForInterrupt}
            aria-label={t('Interrupt button')}
            tooltipProps={{
              title: waitingForInterrupt ? t('Winding down...') : t('Interrupt'),
            }}
          />
        ) : (
          <Button
            icon={<IconArrow direction="right" />}
            onClick={onSend}
            size="md"
            variant="secondary"
            disabled={!inputValue.trim()}
            aria-label={t('Send message')}
          />
        )}
        {enabled && hasCodeChanges && (
          <PRWidget
            ref={prWidgetButtonRef}
            blocks={blocks}
            repoPRStates={repoPRStates}
            onCreatePR={onCreatePR}
            onToggleMenu={onPRWidgetClick}
          />
        )}
      </InputRow>
    </InputBlock>
  );
}

// Styled components
const InputBlock = styled('div')`
  width: 100%;
  background: ${p => p.theme.tokens.background.primary};
  position: sticky;
  bottom: 0;
`;

const InputRow = styled('div')`
  display: flex;
  align-items: flex-end;
  gap: ${p => p.theme.space.sm};
  margin: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
`;

const StyledInputGroup = styled(InputGroup)<{interrupted?: boolean}>`
  flex: 1;

  textarea {
    resize: none;

    &::placeholder {
      color: ${p => (p.interrupted ? p.theme.tokens.content.warning : undefined)};
    }
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
