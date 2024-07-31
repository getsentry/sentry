import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

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
    <StyledInput
      type="text"
      value={inputValue}
      onChange={handleOnChange}
      onKeyDown={handleOnKeyDown}
      onBlur={handleOnBlur}
      ref={inputRef}
      size={inputValue.length > 1 ? inputValue.length - 1 : 1}
    />
  ) : (
    label
  );
}

export default EditableTabTitle;

const StyledInput = styled('input')`
  border: none !important;
  width: fit-content;
  background: transparent;
  outline: none;
  height: auto;
  padding: 0;
  font-size: inherit;
  &,
  &:focus,
  &:active,
  &:hover {
    box-shadow: none;
  }
`;
