import {useEffect} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {ButtonBar} from '@sentry/scraps/button/buttonBar';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea/textarea';

import {IconMenu} from 'sentry/icons';
import {t} from 'sentry/locale';

interface FileApprovalActions {
  currentIndex: number;
  onApprove: () => void;
  onReject: () => void;
  totalPatches: number;
}

interface InputSectionProps {
  focusedBlockIndex: number;
  inputValue: string;
  interruptRequested: boolean;
  isPolling: boolean;
  menu: React.ReactElement;
  onClear: () => void;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onInputClick: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onMenuButtonClick: () => void;
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileApprovalActions?: FileApprovalActions;
  isMinimized?: boolean;
  isVisible?: boolean;
}

function InputSection({
  menu,
  onMenuButtonClick,
  inputValue,
  focusedBlockIndex,
  isMinimized = false,
  isPolling,
  interruptRequested,
  isVisible = false,
  onInputChange,
  onInputClick,
  onKeyDown,
  textAreaRef,
  fileApprovalActions,
}: InputSectionProps) {
  const getPlaceholder = () => {
    if (focusedBlockIndex !== -1) {
      return 'Press Tab ⇥ to return here';
    }
    if (interruptRequested) {
      return 'Winding down...';
    }
    if (isPolling) {
      return 'Press Esc to interrupt';
    }
    return 'Type your message or / command and press Enter ↵';
  };

  // Handle keyboard shortcuts for file approval
  useEffect(() => {
    if (!fileApprovalActions || !isVisible || isMinimized) {
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
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        fileApprovalActions.onReject();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [fileApprovalActions, isVisible, isMinimized]);

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
                {t('Reject')} ⌫
              </Button>
              <Button size="md" priority="primary" onClick={onApprove}>
                {t('Approve')} ⏎
              </Button>
            </ButtonBar>
          </Flex>
        </Container>
      </ActionBar>
    );
  }

  return (
    <InputBlock>
      {menu}
      <InputRow>
        <ButtonContainer>
          <Button
            priority="default"
            aria-label="Toggle Menu"
            onClick={onMenuButtonClick}
            icon={<IconMenu size="md" />}
          />
        </ButtonContainer>
        <InputTextarea
          ref={textAreaRef}
          value={inputValue}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          onClick={onInputClick}
          placeholder={getPlaceholder()}
          rows={1}
          data-test-id="seer-explorer-input"
        />
      </InputRow>
    </InputBlock>
  );
}

export default InputSection;

// Styled components
const InputBlock = styled('div')`
  width: 100%;
  background: ${p => p.theme.background};
  position: sticky;
  bottom: 0;
`;

const InputRow = styled('div')`
  display: flex;
  align-items: stretch;
  width: 100%;
  padding: 0;
`;

const ButtonContainer = styled('div')`
  display: flex;
  align-items: center;
  padding: ${p => p.theme.space.sm};
  padding-top: ${p => p.theme.space.md};

  button {
    width: auto;
    padding: ${p => p.theme.space.md};
  }
`;

const InputTextarea = styled(TextArea)`
  width: 100%;
  margin: ${p => p.theme.space.sm} ${p => p.theme.space.sm} ${p => p.theme.space.sm} 0;
  color: ${p => p.theme.textColor};
  resize: none;
  overflow-y: auto;
`;

const ActionBar = styled(motion.div)`
  flex-shrink: 0;
  width: 100%;
  background: ${p => p.theme.background};
  position: sticky;
  bottom: 0;
`;
