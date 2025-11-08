import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {IconMenu} from 'sentry/icons';
import {space} from 'sentry/styles/space';

import {ExplorerMenu} from './explorerMenu';
import {useExplorerPanelContext} from './explorerPanelContext';

function InputSection({
  onKeyDown,
}: {
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const {
    inputValue,
    clearInput,
    focusedBlockIndex,
    isPolling,
    interruptRequested,
    onInputChange,
    onInputClick,
    textAreaRef,
    menuMode,
    setMenuMode,
  } = useExplorerPanelContext();

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
    if (menuMode === 'hidden') {
      return 'Type your message or / command and press Enter ↵';
    }
    return 'Type your message and press Enter ↵';
  };

  const onMenuButtonClick = useCallback(() => {
    if (menuMode === 'hidden') {
      setMenuMode('slash-commands-manual');
    } else if (menuMode === 'slash-commands-keyboard') {
      clearInput();
      setMenuMode('hidden');
    } else {
      setMenuMode('hidden');
    }
  }, [menuMode, setMenuMode, clearInput]);

  return (
    <InputBlock>
      <InputContainer onClick={onInputClick}>
        <ExplorerMenu />
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
            placeholder={getPlaceholder()}
            rows={1}
            data-test-id="seer-explorer-input"
          />
        </InputRow>
        {focusedBlockIndex === -1 && <FocusIndicator />}
      </InputContainer>
    </InputBlock>
  );
}

export default InputSection;

// Styled components
const InputBlock = styled('div')`
  width: 100%;
  border-top: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.background};
  position: sticky;
  bottom: 0;
`;

const InputContainer = styled('div')`
  position: relative;
  width: 100%;
`;

const InputRow = styled('div')`
  display: flex;
  align-items: stretch;
  width: 100%;
  padding: 0;
  gap: ${space(1)};
`;

const ButtonContainer = styled('div')`
  display: flex;
  align-items: stretch;

  button {
    flex: 1;
    height: 100%;
    min-height: 100%;
    border-radius: 0;
    border-left: none;
    border-top: none;
    border-bottom: none;
  }
`;

const FocusIndicator = styled('div')`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 3px;
  background: ${p => p.theme.purple400};
`;

const InputTextarea = styled('textarea')`
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  padding: ${space(2)} ${space(2)} ${space(2)} 0;
  color: ${p => p.theme.textColor};
  resize: none;
  min-height: 40px;
  max-height: 120px;
  line-height: 1.4;
  overflow-y: auto;
  box-sizing: border-box;

  &::placeholder {
    color: ${p => p.theme.subText};
  }

  &:focus {
    outline: none;
  }
`;
