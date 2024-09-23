import {useContext, useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {GrowingInput} from 'sentry/components/growingInput';
import {TabsContext} from 'sentry/components/tabs';
import {Tooltip} from 'sentry/components/tooltip';

interface EditableTabTitleProps {
  isEditing: boolean;
  label: string;
  onChange: (newLabel: string) => void;
  setIsEditing: (isEditing: boolean) => void;
  tabKey: string;
}

function EditableTabTitle({
  label,
  onChange,
  isEditing,
  tabKey,
  setIsEditing,
}: EditableTabTitleProps) {
  const [inputValue, setInputValue] = useState(label);
  const {tabListState} = useContext(TabsContext);

  useEffect(() => {
    setInputValue(label);
  }, [label]);

  const theme = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const isEmpty = !inputValue.trim();

  const isSelected = tabListState?.selectedKey === tabKey;

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
      });
    } else {
      inputRef.current?.blur();
    }
  }, [isEditing, inputRef]);

  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <Tooltip title={label} showOnlyOnOverflow skipWrapper>
      <motion.div layout="position" transition={{duration: 0.25}}>
        {isSelected ? (
          <StyledGrowingInput
            value={inputValue}
            onChange={handleOnChange}
            onKeyDown={handleOnKeyDown}
            onDoubleClick={() => isSelected && setIsEditing(true)}
            onBlur={handleOnBlur}
            ref={inputRef}
            style={memoizedStyles}
            isEditing={isEditing}
            onFocus={e => e.target.select()}
            onPointerDown={e => {
              e.stopPropagation();
            }}
            onMouseDown={e => {
              e.stopPropagation();
            }}
            maxLength={128}
          />
        ) : (
          <UnselectedTabTitle>{label}</UnselectedTabTitle>
        )}
      </motion.div>
    </Tooltip>
  );
}

export default EditableTabTitle;

const UnselectedTabTitle = styled('div')`
  height: 20px;
  /* The max width is slightly smaller than the GrowingInput since the text in the growing input is bolded */
  max-width: 310px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledGrowingInput = styled(GrowingInput)<{
  isEditing: boolean;
}>`
  position: relative;
  border: none;
  padding: 0;
  background: transparent;
  min-height: 0px;
  height: 20px;
  border-radius: 0px;
  text-overflow: ellipsis;
  cursor: ${p => (p.isEditing ? 'text' : 'pointer')};

  ${p => !p.isEditing && `max-width: 325px;`}

  &,
  &:focus,
  &:active,
  &:hover {
    box-shadow: none;
  }
`;
