import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {IconChevron, IconMenu} from 'sentry/icons';
import {space} from 'sentry/styles/space';

import {useExplorerMenu} from './explorerMenu';
import {useExplorerPanelContext} from './explorerPanelContext';

function InputSection() {
  const {
    inputValue,
    clearInput,
    focusedBlockIndex,
    isPolling,
    interruptRequested,
    onInputChange,
    onKeyDown,
    onInputClick,
    textAreaRef,
  } = useExplorerPanelContext();

  const {menu, menuMode, setMenuMode} = useExplorerMenu();

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

  return (
    <InputBlock>
      <InputContainer onClick={onInputClick}>
        {menu}
        <InputRow>
          <Button onClick={onMenuButtonClick}>
            {menuMode === 'hidden' ? (
              <IconMenu size="sm" />
            ) : (
              <IconChevron direction="down" size="sm" />
            )}
          </Button>
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
  align-items: flex-start;
  width: 100%;
`;

// const ChevronIcon = styled(IconChevron)`
//   color: ${p => p.theme.subText};
//   margin-top: 18px;
//   margin-left: ${space(2)};
//   margin-right: ${space(1)};
//   flex-shrink: 0;
// `;

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
