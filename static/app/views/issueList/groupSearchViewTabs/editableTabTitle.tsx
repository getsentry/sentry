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
    if (!isEditing) {
      return;
    }
    if (isEmpty) {
      setInputValue(label);
      return;
    }
    if (inputValue !== label) {
      onChange(inputValue);
    }

    setIsEditing(false);
  };

  const handleOnKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleOnBlur();
    }
    if (e.key === 'Escape') {
      setInputValue(label);
      setIsEditing(false);
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === ' ') {
      e.stopPropagation();
    }
  };

  useEffect(() => {
    setTimeout(() => {
      inputRef?.current?.focus();
    }, 0);
  }, [isEditing, inputRef]);

  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return isEditing ? (
    <StyledGrowingInput
      type="text"
      value={inputValue}
      onChange={handleOnChange}
      onKeyDown={handleOnKeyDown}
      onBlur={handleOnBlur}
      ref={inputRef}
    />
  ) : (
    <div style={{height: '20px'}}>{label}</div>
  );
}

export default EditableTabTitle;

const StyledGrowingInput = styled(GrowingInput)`
  border: none;
  padding: 0;
  background: transparent;
  min-height: 0px;
  height: 20px;

  &,
  &:focus,
  &:active,
  &:hover {
    box-shadow: none;
  }
`;
