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
    <Wrapper>
      <InnerWrapper ref={innerWrapperRef} isDisabled={isDisabled} isEditing={isEditing}>
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
          <React.Fragment>
            <Label
              onClick={isDisabled ? undefined : handleEditClick}
              ref={labelRef}
              data-test-id="editable-text-label"
            >
              <InnerLabel>{inputValue}</InnerLabel>
            </Label>
            {!isDisabled && <StyledIconEdit />}
          </React.Fragment>
        )}
      </InnerWrapper>
    </Wrapper>
  );
}

export default EditableText;

const Label = styled('div')`
  display: inline-block;
  border-radius: ${p => p.theme.borderRadius};
  text-align: left;
  padding-left: 10px;
  height: 40px;
  max-width: 100%;
`;

const InnerLabel = styled(TextOverflow)`
  border-top: 1px solid transparent;
  border-bottom: 1px dotted ${p => p.theme.gray200};
  transition: border 150ms;
  height: 40px;
  line-height: 38px;
`;

const StyledIconEdit = styled(IconEdit)`
  height: 40px;
  position: absolute;
  right: 0;
`;

const Wrapper = styled('div')`
  display: flex;
  justify-content: flex-start;
  height: 40px;
`;

const InnerWrapper = styled('div')<{isDisabled: boolean; isEditing: boolean}>`
  position: relative;
  display: inline-flex;
  max-width: 100%;

  ${p =>
    p.isDisabled
      ? `
          ${StyledIconEdit} {
            cursor: default;
          }

          ${InnerLabel} {
            border-bottom-color: transparent;
          }
        `
      : `
       ${!p.isEditing && `padding-right: 25px;`}
        :hover {
          padding-right: 0;
          ${StyledIconEdit} {
            display: none;
          }
          ${Label} {
            background: ${p.theme.gray100};
            padding: 0 14px 0 10px;
          }
          ${InnerLabel} {
            border-bottom-color: transparent;
          }
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
  border-color: transparent;
`;

const StyledInput = styled(Input)`
  line-height: 40px;
  height: 40px;
  border: none !important;
  background: ${p => p.theme.gray100};
  &,
  &:focus,
  &:active,
  &:hover {
    box-shadow: none;
  }
`;

const InputLabel = styled('div')`
  width: auto;
  height: 40px;
  padding: ${space(1.5)};
  position: relative;
  z-index: -1;
`;
