import React, {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import TextOverflow from 'app/components/textOverflow';
import {IconEdit} from 'app/icons/iconEdit';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {defined} from 'app/utils';
import useKeypress from 'app/utils/useKeyPress';
import useOnClickOutside from 'app/utils/useOnClickOutside';
import Input from 'app/views/settings/components/forms/controls/input';
import Field from 'app/views/settings/components/forms/field';

type Props = {
  value: string;
  onChange: (value: string) => void;
};

function EditableText({value, onChange}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  const isEmpty = !inputValue.trim();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const enter = useKeypress('Enter');
  const esc = useKeypress('Escape');

  // check to see if the user clicked outside of this component
  useOnClickOutside(wrapperRef, () => {
    if (isEditing && !isEmpty) {
      onChange(inputValue);
      setIsEditing(false);
    }
  });

  const onEnter = useCallback(() => {
    if (enter && !isEmpty) {
      onChange(inputValue);
      setIsEditing(false);
    }
  }, [enter, inputValue, onChange]);

  const onEsc = useCallback(() => {
    if (esc) {
      setInputValue(value);
      setIsEditing(false);
    }
  }, [esc, value]);

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

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(event.target.value);
  }

  function handleContentClick() {
    setIsEditing(true);
  }

  return (
    <Wrapper ref={wrapperRef}>
      {isEditing ? (
        <InputWrapper isEmpty={isEmpty}>
          <StyledField
            error={isEmpty ? t('Text required') : undefined}
            inline={false}
            flexibleControlStateSize
            stacked
            required
          >
            <StyledInput ref={inputRef} value={inputValue} onChange={handleInputChange} />
          </StyledField>
          <InputLabel>{inputValue}</InputLabel>
        </InputWrapper>
      ) : (
        <Content onClick={handleContentClick} ref={contentRef}>
          <Label>
            <InnerLabel>{inputValue}</InnerLabel>
          </Label>
          <StyledIconEdit />
        </Content>
      )}
    </Wrapper>
  );
}

export default EditableText;

const Content = styled('div')`
  height: 40px;
  position: relative;
  max-width: calc(100% - 22px);
  padding-right: 22px;
`;

const Label = styled('div')`
  display: inline-block;
  border: 1px solid transparent;
  border-radius: ${p => p.theme.borderRadius};
  transition: border 150ms;
  text-align: left;
  padding: 0 10px;
  height: 40px;
  max-width: 100%;
`;

const InnerLabel = styled(TextOverflow)`
  border-bottom: 1px dotted ${p => p.theme.gray200};
  transition: border 150ms;
  height: 39px;
  line-height: 39px;
`;

const StyledIconEdit = styled(IconEdit)`
  opacity: 0;
  transition: opacity 150ms;
  margin-left: ${space(0.75)};
  height: 40px;
  position: absolute;
  right: 0;
`;

const Wrapper = styled('div')`
  display: flex;
  justify-content: flex-start;
  height: 40px;
  :hover {
    ${StyledIconEdit} {
      opacity: 1;
    }
    ${Label} {
      border-color: ${p => p.theme.gray300};
    }
    ${InnerLabel} {
      border-bottom-color: transparent;
    }
  }
`;

const InputWrapper = styled('div')<{isEmpty: boolean}>`
  position: relative;
  max-width: 100%;
  min-width: ${p => (p.isEmpty ? '100px' : '50px')};
`;

const StyledField = styled(Field)`
  width: 100%;
  padding: 0;
  position: absolute;
  right: 0;
`;

const StyledInput = styled(Input)`
  &,
  &:focus,
  &:active,
  &:hover {
    box-shadow: none;
  }
`;

const InputLabel = styled('div')`
  width: auto;
  opacity: 0;
  padding: ${space(1.5)};
  height: 40px;
  position: relative;
  z-index: -1;
`;
