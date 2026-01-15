import type {
  ChangeEventHandler,
  ClipboardEventHandler,
  FocusEventHandler,
  KeyboardEventHandler,
  MouseEventHandler,
  Ref,
} from 'react';
import {useCallback, useRef} from 'react';
import styled from '@emotion/styled';
import {useTextField} from '@react-aria/textfield';
import {mergeRefs} from '@react-aria/utils';
import type {KeyboardEvent} from '@react-types/shared';

import {Flex} from '@sentry/scraps/layout';

import {Input} from 'sentry/components/core/input';
import {useAutosizeInput} from 'sentry/components/core/input/useAutosizeInput';

interface InputBoxProps {
  inputLabel: string;
  inputValue: string;
  ['data-test-id']?: string;
  onClick?: MouseEventHandler<HTMLInputElement>;
  onInputBlur?: FocusEventHandler<HTMLInputElement>;
  onInputChange?: ChangeEventHandler<HTMLInputElement>;
  onInputCommit?: (value: string) => void;
  onInputEscape?: () => void;
  onInputFocus?: FocusEventHandler<HTMLInputElement>;
  onKeyDown?: (evt: KeyboardEvent) => void;
  onKeyDownCapture?: KeyboardEventHandler<HTMLInputElement>;
  onPaste?: ClipboardEventHandler<HTMLInputElement>;
  placeholder?: string;
  ref?: Ref<HTMLInputElement>;
  tabIndex?: number;
}

export function InputBox({
  inputLabel,
  inputValue,
  onClick,
  onInputBlur,
  onInputChange,
  onInputCommit,
  onInputEscape,
  onInputFocus,
  onKeyDown,
  onKeyDownCapture,
  onPaste,
  ['data-test-id']: dataTestId,
  placeholder,
  ref,
  tabIndex,
}: InputBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputKeyDown = useCallback(
    (evt: KeyboardEvent) => {
      onKeyDown?.(evt);
      switch (evt.key) {
        case 'Escape':
          evt.stopPropagation();
          onInputEscape?.();
          return;
        case 'Enter':
          evt.preventDefault();
          onInputCommit?.(inputValue);
          return;
        default:
          return;
      }
    },
    [inputValue, onInputCommit, onInputEscape, onKeyDown]
  );

  const handleInputBlur: FocusEventHandler<HTMLInputElement> = useCallback(
    evt => {
      onInputBlur?.(evt);
    },
    [onInputBlur]
  );

  const handleInputFocus: FocusEventHandler<HTMLInputElement> = useCallback(
    evt => {
      onInputFocus?.(evt);
    },
    [onInputFocus]
  );

  const {inputProps} = useTextField(
    {
      'aria-label': inputLabel,
      value: inputValue,
      onKeyDown: handleInputKeyDown,
      onBlur: handleInputBlur,
      onFocus: handleInputFocus,
      autoComplete: 'off',
      validate: undefined,
    },
    inputRef
  );

  const handleInputClick: MouseEventHandler<HTMLInputElement> = useCallback(
    evt => {
      evt.stopPropagation();
      inputProps.onClick?.(evt);
      onClick?.(evt);
    },
    [inputProps, onClick]
  );

  const autosizeInputRef = useAutosizeInput({value: inputValue});

  return (
    <Flex align="stretch" width="100%" height="100%" position="relative">
      <UnstyledInput
        {...inputProps}
        size="md"
        ref={mergeRefs(ref, inputRef, autosizeInputRef)}
        type="text"
        placeholder={placeholder}
        onBlur={handleInputBlur}
        onClick={handleInputClick}
        onKeyDown={handleInputKeyDown}
        onKeyDownCapture={onKeyDownCapture}
        value={inputValue}
        onChange={onInputChange ?? (() => {})}
        tabIndex={tabIndex}
        onPaste={onPaste}
        disabled={false}
        data-test-id={dataTestId}
      />
    </Flex>
  );
}

const UnstyledInput = styled(Input)`
  background: transparent;
  border: none;
  box-shadow: none;
  flex-grow: 1;
  padding: 0;
  height: auto;
  min-height: auto;
  resize: none;
  min-width: 1px;
  border-radius: 0;

  &:focus {
    outline: none;
    border: none;
    box-shadow: none;
  }
`;
