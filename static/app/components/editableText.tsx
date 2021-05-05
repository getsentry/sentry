import {useCallback, useEffect, useRef, useState} from 'react';
import * as React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import TextOverflow from 'app/components/textOverflow';
import {IconEdit} from 'app/icons/iconEdit';
import space from 'app/styles/space';
import {defined} from 'app/utils';
import useKeypress from 'app/utils/useKeyPress';
import useOnClickOutside from 'app/utils/useOnClickOutside';
import Input from 'app/views/settings/components/forms/controls/input';

type Props = {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  errorMessage?: React.ReactNode;
  successMessage?: React.ReactNode;
  isDisabled?: boolean;
};

function EditableText({
  value,
  onChange,
  name,
  errorMessage,
  successMessage,
  isDisabled = false,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  const isEmpty = !inputValue.trim();

  const innerWrapperRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const enter = useKeypress('Enter');
  const esc = useKeypress('Escape');

  function revertValueAndCloseEditor() {
    if (value !== inputValue) {
      setInputValue(value);
    }

    if (isEditing) {
      setIsEditing(false);
    }
  }

  // check to see if the user clicked outside of this component
  useOnClickOutside(innerWrapperRef, () => {
    if (isEditing) {
      if (isEmpty) {
        displayStatusMessage('error');
        return;
      }
      if (inputValue !== value) {
        onChange(inputValue);
        displayStatusMessage('success');
      }
      setIsEditing(false);
    }
  });

  const onEnter = useCallback(() => {
    if (enter) {
      if (isEmpty) {
        displayStatusMessage('error');
        return;
      }

      if (inputValue !== value) {
        onChange(inputValue);
        displayStatusMessage('success');
      }

      setIsEditing(false);
    }
  }, [enter, inputValue, onChange]);

  const onEsc = useCallback(() => {
    if (esc) {
      revertValueAndCloseEditor();
    }
  }, [esc]);

  useEffect(() => {
    revertValueAndCloseEditor();
  }, [isDisabled, value]);

  // focus the cursor in the input field on edit start
  useEffect(() => {
    if (isEditing) {
      const inputElement = inputRef.current;
      if (defined(inputElement)) {
        inputElement.focus();
      }
    }
  }, [isEditing]);

  useEffect(() => {
    if (isEditing) {
      // if Enter is pressed, save the value and close the editor
      onEnter();
      // if Escape is pressed, revert the value and close the editor
      onEsc();
    }
  }, [onEnter, onEsc, isEditing]); // watch the Enter and Escape key presses

  function displayStatusMessage(status: 'error' | 'success') {
    if (status === 'error') {
      if (errorMessage) {
        addErrorMessage(errorMessage);
      }
      return;
    }

    if (successMessage) {
      addSuccessMessage(successMessage);
    }
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(event.target.value);
  }

  function handleEditClick() {
    setIsEditing(true);
  }

  return (
    <Wrapper isDisabled={isDisabled} isEditing={isEditing}>
      {isEditing ? (
        <InputWrapper
          ref={innerWrapperRef}
          isEmpty={isEmpty}
          data-test-id="editable-text-input"
        >
          <StyledInput
            name={name}
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
          />
          <InputLabel>{inputValue}</InputLabel>
        </InputWrapper>
      ) : (
        <Label
          onClick={isDisabled ? undefined : handleEditClick}
          ref={labelRef}
          data-test-id="editable-text-label"
        >
          <InnerLabel>{inputValue}</InnerLabel>
          {!isDisabled && <IconEdit />}
        </Label>
      )}
    </Wrapper>
  );
}

export default EditableText;

const Label = styled('div')`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: ${space(1)};
  cursor: pointer;
`;

const InnerLabel = styled(TextOverflow)`
  border-top: 1px solid transparent;
  border-bottom: 1px dotted ${p => p.theme.gray200};
`;

const InputWrapper = styled('div')<{isEmpty: boolean}>`
  display: inline-block;
  background: ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
  margin: -${space(0.5)} -${space(1)};
  max-width: calc(100% + ${space(2)});
`;

const StyledInput = styled(Input)`
  border: none !important;
  background: transparent;
  height: auto;
  min-height: 34px;
  padding: ${space(0.5)} ${space(1)};
  &,
  &:focus,
  &:active,
  &:hover {
    box-shadow: none;
  }
`;

const InputLabel = styled('div')`
  height: 0;
  opacity: 0;
  white-space: pre;
  padding: 0 ${space(1)};
`;

const Wrapper = styled('div')<{isDisabled: boolean; isEditing: boolean}>`
  display: flex;

  ${p =>
    p.isDisabled &&
    `
      ${InnerLabel} {
        border-bottom-color: transparent;
      }
    `}
`;
