import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {IconMenu} from 'sentry/icons';
import {space} from 'sentry/styles/space';

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
}

function InputSection({
  menu,
  onMenuButtonClick,
  inputValue,
  focusedBlockIndex,
  isPolling,
  interruptRequested,
  onInputChange,
  onInputClick,
  onKeyDown,
  textAreaRef,
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
      {focusedBlockIndex === -1 && <FocusIndicator />}
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
  padding: ${p => p.theme.space.sm};

  button {
    flex: 1;
    height: 100%;
    min-height: 100%;
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
