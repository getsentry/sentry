import styled from '@emotion/styled';

import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';

import SlashCommands, {type SlashCommand} from './slashCommands';

interface InputSectionProps {
  focusedBlockIndex: number;
  inputValue: string;
  onCommandSelect: (command: SlashCommand) => void;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onInputClick: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onMaxSize: () => void;
  onMedSize: () => void;
  onMinSize: () => void;
  onSlashCommandsClose: () => void;
  showSlashCommands: boolean;
  ref?: React.RefObject<HTMLTextAreaElement>;
}

function InputSection({
  inputValue,
  focusedBlockIndex,
  onInputChange,
  onKeyDown,
  onInputClick,
  onCommandSelect,
  onSlashCommandsClose,
  onMaxSize,
  onMedSize,
  onMinSize,
  ref,
}: InputSectionProps) {
  return (
    <InputBlock>
      <InputContainer onClick={onInputClick}>
        <SlashCommands
          inputValue={inputValue}
          onCommandSelect={onCommandSelect}
          onClose={onSlashCommandsClose}
          onMaxSize={onMaxSize}
          onMedSize={onMedSize}
          onMinSize={onMinSize}
        />
        <InputRow>
          <ChevronIcon direction="right" size="sm" />
          <InputTextarea
            ref={ref}
            value={inputValue}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            placeholder={
              focusedBlockIndex === -1
                ? 'Type your message or / command and press Enter ↵'
                : 'Press Tab ⇥ to return here'
            }
            rows={1}
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

const ChevronIcon = styled(IconChevron)`
  color: ${p => p.theme.subText};
  margin-top: 18px;
  margin-left: ${space(2)};
  margin-right: ${space(1)};
  flex-shrink: 0;
`;

const FocusIndicator = styled('div')`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 3px;
  background: ${p => p.theme.pink400};
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
