import {useCallback, useEffect, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Input} from 'sentry/components/core/input';
import TextOverflow from 'sentry/components/textOverflow';
import {IconEdit} from 'sentry/icons/iconEdit';
import {space} from 'sentry/styles/space';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';

type Props = {
  onChange: (value: string) => void;
  value: string;
  /**
   * When true, clearing the input and blurring cancels the edit and restores
   * the previous value instead of showing an error toast.
   */
  allowEmpty?: boolean;
  'aria-label'?: string;
  autoSelect?: boolean;
  className?: string;
  errorMessage?: React.ReactNode;
  isDisabled?: boolean;
  maxLength?: number;
  name?: string;
  /**
   * The placeholder text to display when the input is empty.
   */
  placeholder?: string;
  successMessage?: React.ReactNode;
};

function EditableText({
  value,
  onChange,
  name,
  errorMessage,
  successMessage,
  maxLength,
  isDisabled = false,
  autoSelect = false,
  className,
  'aria-label': ariaLabel,
  placeholder,
  allowEmpty = false,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  // Immediately reflect the last committed value while we wait for the parent prop update
  const [optimisticValue, setOptimisticValue] = useState<string | null>(null);
  // Current keystrokes while editing; cleared whenever editing ends
  const [draftValue, setDraftValue] = useState<string | null>(null);

  const currentValue = optimisticValue ?? value;
  const currentDraft = draftValue ?? currentValue;
  const isDraftEmpty = !currentDraft.trim();

  const innerWrapperRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousValueRef = useRef(value);

  const showStatusMessage = useCallback(
    (status: 'error' | 'success') => {
      if (status === 'error') {
        if (errorMessage) {
          addErrorMessage(errorMessage);
        }
        return;
      }

      if (successMessage) {
        addSuccessMessage(successMessage);
      }
    },
    [errorMessage, successMessage]
  );

  const exitEditing = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleCancel = useCallback(() => {
    setDraftValue(null);
    exitEditing();
  }, [exitEditing]);

  const handleCommit = useCallback(() => {
    if (isDraftEmpty) {
      showStatusMessage('error');
      return false;
    }

    if (currentDraft !== currentValue) {
      onChange(currentDraft);
      showStatusMessage('success');
    }

    exitEditing();
    setOptimisticValue(currentDraft);
    setDraftValue(null);
    return true;
  }, [
    currentDraft,
    currentValue,
    exitEditing,
    isDraftEmpty,
    onChange,
    showStatusMessage,
  ]);

  const handleEmptyBlur = useCallback(() => {
    if (allowEmpty) {
      handleCancel();
    } else {
      showStatusMessage('error');
    }
  }, [allowEmpty, handleCancel, showStatusMessage]);

  // Close editing if the field becomes disabled (e.g. form revalidation)
  useEffect(() => {
    if (isDisabled) {
      handleCancel();
    }
  }, [handleCancel, isDisabled]);

  // Reset our optimistic/draft state whenever the controlled value changes externally
  useEffect(() => {
    if (previousValueRef.current === value) {
      return;
    }

    previousValueRef.current = value;
    setOptimisticValue(null);

    if (isEditing) {
      setDraftValue(null);
      exitEditing();
    }
  }, [exitEditing, isEditing, value]);

  // Focus the input whenever we enter editing mode
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const handleClickOutside = useCallback(() => {
    if (!isEditing) {
      return;
    }

    if (isDraftEmpty) {
      handleEmptyBlur();
      return;
    }

    handleCommit();
  }, [handleCommit, handleEmptyBlur, isDraftEmpty, isEditing]);

  useOnClickOutside(innerWrapperRef, handleClickOutside);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setDraftValue(event.target.value);
  }, []);

  const handleEditClick = useCallback(() => {
    if (isDisabled) {
      return;
    }

    setDraftValue(currentValue);
    setIsEditing(true);
  }, [currentValue, isDisabled]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleCommit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        handleCancel();
      }
    },
    [handleCancel, handleCommit]
  );

  return (
    <Wrapper isDisabled={isDisabled} isEditing={isEditing} className={className}>
      {isEditing ? (
        <InputWrapper
          ref={innerWrapperRef}
          isEmpty={isDraftEmpty}
          data-test-id="editable-text-input"
        >
          <StyledInput
            aria-label={ariaLabel}
            name={name}
            ref={inputRef}
            value={currentDraft}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={event => autoSelect && event.target.select()}
            maxLength={maxLength}
            placeholder={placeholder}
          />
          <InputLabel>{currentDraft}</InputLabel>
        </InputWrapper>
      ) : (
        <Label
          onClick={isDisabled ? undefined : handleEditClick}
          ref={labelRef}
          isDisabled={isDisabled}
          data-test-id="editable-text-label"
        >
          <InnerLabel>{currentValue || placeholder}</InnerLabel>
          {!isDisabled && <IconEdit />}
        </Label>
      )}
    </Wrapper>
  );
}

export default EditableText;

const Label = styled('div')<{isDisabled: boolean}>`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: ${space(1)};
  cursor: ${p => (p.isDisabled ? 'default' : 'pointer')};
`;

const InnerLabel = styled(TextOverflow)`
  border-top: 1px solid transparent;
  border-bottom: 1px dotted ${p => p.theme.tokens.border.primary};
  line-height: 38px;
`;

const InputWrapper = styled('div')<{isEmpty: boolean}>`
  display: inline-block;
  background: ${p => p.theme.tokens.background.tertiary};
  border-radius: ${p => p.theme.radius.md};
  margin: -${space(0.5)} -${space(1)};
  padding: ${space(0.5)} ${space(1)};
  max-width: calc(100% + ${space(2)});
`;

const StyledInput = styled(Input)`
  border: none !important;
  background: transparent;
  height: auto;
  min-height: 40px;
  padding: 0;
  font-size: inherit;
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
    css`
      ${InnerLabel} {
        border-bottom-color: transparent;
      }
    `}
`;
