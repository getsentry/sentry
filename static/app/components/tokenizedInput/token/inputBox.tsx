import type {
  ChangeEventHandler,
  FocusEventHandler,
  KeyboardEventHandler,
  MouseEventHandler,
  Ref,
} from 'react';
import {useCallback, useRef} from 'react';
import {useTextField} from '@react-aria/textfield';
import {mergeRefs} from '@react-aria/utils';
import type {KeyboardEvent} from '@react-types/shared';

import {useAutosizeInput} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';

import {UnstyledInput} from 'sentry/components/tokenizedInput/token/unstyledInput';

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
  'data-test-id': dataTestId,
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
        onBlur={handleInputBlur}
        onClick={handleInputClick}
        onKeyDown={handleInputKeyDown}
        onKeyDownCapture={onKeyDownCapture}
        value={inputValue}
        onChange={onInputChange ?? (() => {})}
        tabIndex={tabIndex}
        disabled={false}
        data-test-id={dataTestId}
      />
    </Flex>
  );
}
