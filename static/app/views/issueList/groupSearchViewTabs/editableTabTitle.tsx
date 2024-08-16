import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {GrowingInput} from 'sentry/components/growingInput';

function EditableTabTitle({
  label,
  onChange,
  isEditing,
  setIsEditing,
}: {
  isEditing: boolean;
  label: string;
  onChange: (newLabel: string) => void;
  setIsEditing: (isEditing: boolean) => void;
}) {
  const [inputValue, setInputValue] = useState(label);

  const inputRef = useRef<HTMLInputElement>(null);
  const isEmpty = !inputValue.trim();

  const handleOnBlur = () => {
    const trimmedInputValue = inputValue.trim();
    if (!isEditing) {
      return;
    }
    if (isEmpty) {
      setInputValue(label);
      setIsEditing(false);
      return;
    }
    if (trimmedInputValue !== label) {
      onChange(trimmedInputValue);
      setInputValue(trimmedInputValue);
    }
    setIsEditing(false);
  };

  const handleOnKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleOnBlur();
    }
    if (e.key === 'Escape') {
      setInputValue(label.trim());
      setIsEditing(false);
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === ' ') {
      e.stopPropagation();
    }
  };

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => {
        inputRef?.current?.focus();
      }, 0);
    }
  }, [isEditing, inputRef]);

  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return isEditing ? (
    <StyledGrowingInput
      value={inputValue}
      onChange={handleOnChange}
      onKeyDown={handleOnKeyDown}
      onBlur={handleOnBlur}
      ref={inputRef}
    />
  ) : (
    <div style={{height: '20px'}}> {label}</div>
  );
}

export default EditableTabTitle;

const StyledGrowingInput = styled(GrowingInput)`
  border: none;
  padding: 0;
  background: transparent;
  min-height: 0px;
  height: 20px;
  cursor: pointer;
  border-radius: 0px;

  &,
  &:focus,
  &:active,
  &:hover {
    box-shadow: none;
  }
`;
