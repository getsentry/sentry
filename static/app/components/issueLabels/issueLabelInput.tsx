import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface IssueLabelInputProps {
  onAddLabel: (labelName: string) => boolean;
  disabled?: boolean;
  placeholder?: string;
  size?: 'xs' | 'sm' | 'md';
}

export function IssueLabelInput({
  onAddLabel,
  placeholder = t('Add label...'),
  size = 'sm',
  disabled = false,
}: IssueLabelInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSubmit = () => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) {
      setError(t('Label name cannot be empty'));
      return;
    }

    const success = onAddLabel(trimmedValue);
    if (success) {
      setInputValue('');
      setError('');
      setIsEditing(false);
    } else {
      setError(t('Label already exists'));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setInputValue('');
      setError('');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setInputValue('');
    setError('');
  };

  if (!isEditing) {
    return (
      <Button
        size={size}
        icon={<IconAdd size="xs" />}
        onClick={() => setIsEditing(true)}
        disabled={disabled}
      >
        {t('Add Label')}
      </Button>
    );
  }

  return (
    <InputContainer size={size}>
      <StyledInput
        ref={inputRef}
        value={inputValue}
        onChange={e => {
          setInputValue(e.target.value);
          setError('');
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        size={size}
        autoFocus
      />
      <ButtonGroup>
        <Button size={size} onClick={handleSubmit}>
          {t('Add')}
        </Button>
        <Button size={size} onClick={handleCancel}>
          {t('Cancel')}
        </Button>
      </ButtonGroup>
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </InputContainer>
  );
}

// Keeping simple button styling for MVP; we can reintroduce custom styles later if needed.

const InputContainer = styled('div')<{size: string}>`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  min-width: 200px;
`;

const StyledInput = styled(Input)`
  font-size: inherit;
`;

const ButtonGroup = styled('div')`
  display: flex;
  gap: ${space(0.5)};
`;

const ErrorMessage = styled('div')`
  font-size: 11px;
  color: ${p => p.theme.errorText};
`;
