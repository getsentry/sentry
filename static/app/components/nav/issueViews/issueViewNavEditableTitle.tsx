import {useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {GrowingInput} from 'sentry/components/growingInput';
import {Tooltip} from 'sentry/components/tooltip';

interface IssueViewNavEditableTitleProps {
  isEditing: boolean;
  isSelected: boolean;
  label: string;
  onChange: (newLabel: string) => void;
  setIsEditing: (isEditing: boolean) => void;
}

function IssueViewNavEditableTitle({
  label,
  onChange,
  isEditing,
  isSelected,
  setIsEditing,
}: IssueViewNavEditableTitleProps) {
  const [inputValue, setInputValue] = useState(label);

  useEffect(() => {
    setInputValue(label);
  }, [label]);

  const theme = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const isEmpty = !inputValue.trim();

  const memoizedStyles = useMemo(() => {
    return {fontWeight: isSelected ? theme.fontWeightBold : theme.fontWeightNormal};
  }, [isSelected, theme.fontWeightBold, theme.fontWeightNormal]);

  const handleOnBlur = (e: React.FocusEvent<HTMLInputElement, Element>) => {
    e.stopPropagation();
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
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    }
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
        inputRef.current?.select();
      });
    } else {
      inputRef.current?.blur();
    }
  }, [isEditing, inputRef]);

  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <Tooltip title={label} disabled={isEditing} showOnlyOnOverflow skipWrapper>
      <motion.div layout="position" transition={{duration: 0.2}}>
        {isEditing ? (
          <StyledGrowingInput
            value={inputValue}
            onChange={handleOnChange}
            onKeyDown={handleOnKeyDown}
            onBlur={handleOnBlur}
            ref={inputRef}
            style={memoizedStyles}
            isEditing={isEditing}
            maxLength={128}
            onPointerDown={e => {
              e.stopPropagation();
              if (!isEditing) {
                e.preventDefault();
              }
            }}
            onMouseDown={e => {
              e.stopPropagation();
              if (!isEditing) {
                e.preventDefault();
              }
            }}
          />
        ) : (
          <UnselectedTabTitle
            onDoubleClick={() => setIsEditing(true)}
            onPointerDown={e => {
              if (isSelected) {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
            onMouseDown={e => {
              if (isSelected) {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
            isSelected={isSelected}
          >
            {label}
          </UnselectedTabTitle>
        )}
      </motion.div>
    </Tooltip>
  );
}

export default IssueViewNavEditableTitle;

const UnselectedTabTitle = styled('div')<{isSelected: boolean}>`
  height: 20px;
  max-width: ${p => (p.isSelected ? '325px' : '310px')};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 1px;
  cursor: pointer;
  line-height: 1.45;
`;

const StyledGrowingInput = styled(GrowingInput)<{
  isEditing: boolean;
}>`
  position: relative;
  border: none;
  margin: 0;
  padding: 0;
  background: transparent;
  min-height: 0px;
  height: 20px;
  border-radius: 0px;
  text-overflow: ellipsis;
  cursor: text;
  line-height: 1.45;

  &,
  &:focus,
  &:active,
  &:hover {
    box-shadow: none;
  }
`;
