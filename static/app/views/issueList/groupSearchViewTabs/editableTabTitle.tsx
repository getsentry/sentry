import {useEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';

import {GrowingInput} from 'sentry/components/growingInput';

interface EditableTabTitleProps {
  isEditing: boolean;
  isSelected: boolean;
  label: string;
  onChange: (newLabel: string) => void;
  setIsEditing: (isEditing: boolean) => void;
}

function EditableTabTitle({
  label,
  onChange,
  isEditing,
  isSelected,
  setIsEditing,
}: EditableTabTitleProps) {
  const [inputValue, setInputValue] = useState(label);

  const theme = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const isEmpty = !inputValue.trim();

  const handleOnBlur = (e: React.FocusEvent<HTMLInputElement, Element>) => {
    e.preventDefault();
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
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isEditing, inputRef]);

  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <FocusScope>
      <StyledGrowingInput
        value={inputValue}
        onChange={handleOnChange}
        onKeyDown={handleOnKeyDown}
        onBlur={handleOnBlur}
        ref={inputRef}
        style={{fontWeight: isSelected ? theme.fontWeightBold : theme.fontWeightNormal}}
      />
    </FocusScope>
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
