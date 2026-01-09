import {useEffect} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {ButtonBar} from '@sentry/scraps/button/buttonBar';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {InputGroup} from 'sentry/components/core/input/inputGroup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconPause} from 'sentry/icons';
import {t} from 'sentry/locale';

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
  enabled: boolean;
  focusedBlockIndex: number;
  inputValue: string;
  interruptRequested: boolean;
  isPolling: boolean;
  onClear: () => void;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onInputClick: () => void;
  onInterrupt: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileApprovalActions?: FileApprovalActions;
  isMinimized?: boolean;
  isVisible?: boolean;
  questionActions?: QuestionActions;
}

function InputSection({
  enabled,
  inputValue,
  focusedBlockIndex,
  isMinimized = false,
  isPolling,
  interruptRequested,
  isVisible = false,
  onInputChange,
  onInputClick,
  onInterrupt,
  onKeyDown,
  textAreaRef,
  fileApprovalActions,
  questionActions,
}: InputSectionProps) {
  const getPlaceholder = () => {
    if (!enabled) {
      return 'This conversation is owned by another user and is read-only';
    }
    if (focusedBlockIndex !== -1) {
      return 'Press Tab ⇥ to return here';
    }
    return 'Type your message or / command and press Enter ↵';
  };

  // Handle keyboard shortcuts for file approval
  useEffect(() => {
    if (!enabled || !fileApprovalActions || !isVisible || isMinimized) {
      return undefined;
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
      return undefined;
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
        <StyledInputGroup>
          <InputGroup.TextArea
            disabled
            ref={textAreaRef}
            value={inputValue}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            onClick={onInputClick}
            placeholder={getPlaceholder()}
            rows={1}
            data-test-id="seer-explorer-input"
          />
        </StyledInputGroup>
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
            <ButtonBar gap="md">
              <Button size="md" onClick={onReject}>
                {t('Reject')} <Kbd>esc</Kbd>
              </Button>
              <Button size="md" priority="primary" onClick={onApprove}>
                {t('Approve')} <Kbd>↵</Kbd>
              </Button>
            </ButtonBar>
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
            <ButtonBar gap="md">
              {currentIndex > 0 && (
                <Button size="md" onClick={onBack}>
                  {t('Back')} ⌫
                </Button>
              )}
              <Button
                size="md"
                priority="primary"
                onClick={onNext}
                disabled={!canSubmitQuestion}
              >
                {isLastQuestion ? t('Submit') : t('Next')} ⏎
              </Button>
            </ButtonBar>
          </Flex>
        </Container>
      </ActionBar>
    );
  }

  const renderActionButton = () => {
    if (interruptRequested) {
      return (
        <ActionButtonWrapper title={t('Winding down...')}>
          <LoadingIndicator size={16} />
        </ActionButtonWrapper>
      );
    }

    if (isPolling) {
      return (
        <Button
          icon={<IconPause variant="muted" />}
          onClick={onInterrupt}
          size="sm"
          priority="transparent"
          aria-label={t('Interrupt')}
          title={t('Press Esc to interrupt')}
        />
      );
    }

    return null;
  };

  return (
    <InputBlock>
      <StyledInputGroup>
        <InputGroup.TextArea
          ref={textAreaRef}
          value={inputValue}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          onClick={onInputClick}
          placeholder={getPlaceholder()}
          rows={1}
          data-test-id="seer-explorer-input"
        />
        <InputGroup.TrailingItems>{renderActionButton()}</InputGroup.TrailingItems>
      </StyledInputGroup>
    </InputBlock>
  );
}

export default InputSection;

// Styled components
const InputBlock = styled('div')`
  width: 100%;
  background: ${p => p.theme.tokens.background.primary};
  position: sticky;
  bottom: 0;
`;

const StyledInputGroup = styled(InputGroup)`
  margin: ${p => p.theme.space.sm};

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

const ActionButtonWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;

  .loading-indicator {
    margin: 0;
    padding: 0;
  }
`;

const Kbd = styled('kbd')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.xs};
  background: transparent;
  left: 4px;
  position: relative;
`;
