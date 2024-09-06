import {useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

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

  const memoizedStyles = useMemo(() => {
    return {fontWeight: isSelected ? theme.fontWeightBold : theme.fontWeightNormal};
  }, [isSelected, theme.fontWeightBold, theme.fontWeightNormal]);

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

  return isSelected ? (
    <StyledGrowingInput
      value={inputValue}
      onChange={handleOnChange}
      onKeyDown={handleOnKeyDown}
      onDoubleClick={() => isSelected && setIsEditing(true)}
      onBlur={handleOnBlur}
      ref={inputRef}
      style={memoizedStyles}
      isSelected={isSelected}
    />
  ) : (
    <div style={{height: '20px'}}>{label}</div>
  );
}

export default EditableTabTitle;

const StyledGrowingInput = styled(GrowingInput)<{isSelected: boolean}>`
  border: none;
  padding: 0;
  background: transparent;
  min-height: 0px;
  height: 20px;
  border-radius: 0px;

  cursor: ${p => (p.isSelected ? 'auto' : 'pointer')};

  &,
  &:focus,
  &:active,
  &:hover {
    box-shadow: none;
  }
`;
