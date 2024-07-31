import {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import useKeyPress from 'sentry/utils/useKeyPress';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';

function EditableTabTitle({
  label,
  onChange,
  isEditing,
  setIsEditing,
  inputRef,
}: {
  isEditing: boolean;
  label: string;
  onChange: (newLabel: string) => void;
  setIsEditing: (isEditing: boolean) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}) {
  const [inputValue, setInputValue] = useState(label);

  const wrapperRef = useRef<HTMLDivElement>(null);

  const enter = useKeyPress('Enter', undefined, true);
  const esc = useKeyPress('Escape', undefined, true);

  const isEmpty = !inputValue.trim();

  useOnClickOutside(wrapperRef, () => {
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
  });

  const onEnter = useCallback(() => {
    if (enter) {
      if (isEmpty) {
        setInputValue(label);
        return;
      }
      if (inputValue !== label) {
        onChange(inputValue);
      }

      setIsEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enter, inputValue, onChange]);

  const onEsc = useCallback(() => {
    if (esc) {
      if (label !== inputValue) {
        setInputValue(label);
      }
      if (isEditing) {
        setIsEditing(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esc]);

  useEffect(() => {
    if (isEditing) {
      onEnter();
      onEsc();
    }
  }, [onEnter, onEsc, isEditing]);

  useEffect(() => {
    setTimeout(() => {
      inputRef?.current?.focus();
    }, 0);
  }, [isEditing, inputRef]);

  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return isEditing ? (
    <div ref={wrapperRef}>
      <StyledInput
        type="text"
        value={inputValue}
        onChange={handleOnChange}
        onBlur={() => setIsEditing(false)}
        ref={inputRef}
        size={inputValue.length > 1 ? inputValue.length - 1 : 1}
      />
    </div>
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
