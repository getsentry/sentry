import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {TextArea} from '@sentry/scraps/textarea/textarea';

import {IconMenu} from 'sentry/icons';

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
