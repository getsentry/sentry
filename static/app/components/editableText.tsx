import React, {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import TextOverflow from 'app/components/textOverflow';
import {IconEdit} from 'app/icons/iconEdit';
import space from 'app/styles/space';
import {defined} from 'app/utils';
import useKeypress from 'app/utils/useKeyPress';
import useOnClickOutside from 'app/utils/useOnClickOutside';
import Input from 'app/views/settings/components/forms/controls/input';
import Field from 'app/views/settings/components/forms/field';

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

  const innerWrapper = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const enter = useKeypress('Enter');
  const esc = useKeypress('Escape');

  // check to see if the user clicked outside of this component
  useOnClickOutside(innerWrapper, () => {
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
      setInputValue(value);
      setIsEditing(false);
    }
  }, [esc, value]);

  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);

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
      // if Enter is pressed, save the text and close the editor
      onEnter();
      // if Escape is pressed, revert the text and close the editor
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
    if (!isEditing) {
      setIsEditing(true);
      return;
    }

    inputRef.current?.focus();
  }

  return (
    <Wrapper isDisabled={isDisabled}>
      <InnerWrapper ref={innerWrapper}>
        {isEditing ? (
          <InputWrapper isEmpty={isEmpty} data-test-id="editable-text-input">
            <StyledField inline={false} flexibleControlStateSize stacked>
              <StyledInput
                name={name}
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
              />
            </StyledField>
            <InputLabel>{inputValue}</InputLabel>
          </InputWrapper>
        ) : (
          <Label
            onClick={isDisabled ? undefined : handleEditClick}
            ref={labelRef}
            data-test-id="editable-text-label"
          >
            <InnerLabel>{inputValue}</InnerLabel>
          </Label>
        )}
        <StyledIconEdit onClick={isDisabled ? undefined : handleEditClick} />
      </InnerWrapper>
    </Wrapper>
  );
}

export default EditableText;

const Label = styled('div')`
  display: inline-block;
  background: ${p => p.theme.gray100};
  border: 1px solid transparent;
  border-radius: ${p => p.theme.borderRadius};
  text-align: left;
  padding: 0 ${space(1.5)} 0 10px;
  max-width: 100%;
`;

const InnerLabel = styled(TextOverflow)`
  line-height: 38px;
`;

const StyledIconEdit = styled(IconEdit)`
  margin-left: ${space(0.75)};
  height: 40px;
  position: absolute;
  right: 0;
  cursor: pointer;
`;

const InnerWrapper = styled('div')`
  position: relative;
  display: flex;
  padding-right: 22px;
  max-width: calc(100% - 22px);
`;

const Wrapper = styled('div')<{isDisabled: boolean}>`
  display: flex;
  justify-content: flex-start;
  height: 40px;
  ${p =>
    p.isDisabled &&
    `
      ${Label} {
        background: none;
      }
      ${StyledIconEdit} {
        cursor: default;
        opacity: 0;
      }
      ${InnerWrapper} {
        padding-right: 0;
      }
    `}
`;

const InputWrapper = styled('div')<{isEmpty: boolean}>`
  position: relative;
  min-width: ${p => (p.isEmpty ? '100px' : '50px')};
  overflow: hidden;
`;

const StyledField = styled(Field)`
  width: 100%;
  padding: 0;
  position: absolute;
  right: 0;
`;

const StyledInput = styled(Input)`
  line-height: 40px;
  height: 40px;
  &,
  &:focus,
  &:active,
  &:hover {
    box-shadow: none;
  }
`;

const InputLabel = styled('div')`
  width: auto;
  padding: ${space(1.5)};
  position: relative;
  z-index: -1;
`;
