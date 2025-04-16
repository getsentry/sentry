import {useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Tooltip} from 'sentry/components/core/tooltip';
import {GrowingInput} from 'sentry/components/growingInput';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useUpdateGroupSearchView} from 'sentry/views/issueList/mutations/useUpdateGroupSearchView';
import type {NavIssueView} from 'sentry/views/nav/secondary/sections/issues/issueViews/issueViewNavItems';

interface IssueViewNavEditableTitleProps {
  isActive: boolean;
  isDragging: boolean;
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
  view: NavIssueView;
}

function IssueViewNavEditableTitle({
  view,
  isActive,
  isEditing,
  setIsEditing,
  isDragging,
}: IssueViewNavEditableTitleProps) {
  const organization = useOrganization();
  const [inputValue, setInputValue] = useState(view.label);

  const {mutate: updateIssueView} = useUpdateGroupSearchView({
    onSuccess: () => {
      trackAnalytics('issue_views.renamed_view', {
        leftNav: true,
        organization: organization.slug,
      });
    },
  });

  useEffect(() => {
    setInputValue(view.label);
  }, [view.label]);

  const theme = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const isEmpty = !inputValue.trim();

  const memoizedStyles = useMemo(() => {
    return {fontWeight: isActive ? theme.fontWeightBold : theme.fontWeightNormal};
  }, [isActive, theme.fontWeightBold, theme.fontWeightNormal]);

  const handleOnBlur = (e: React.FocusEvent<HTMLInputElement, Element>) => {
    e.stopPropagation();
    e.preventDefault();
    const trimmedInputValue = inputValue.trim();
    if (!isEditing) {
      return;
    }

    if (isEmpty) {
      setInputValue(view.label);
      setIsEditing(false);
      return;
    }
    if (trimmedInputValue !== view.label) {
      setInputValue(trimmedInputValue);
      updateIssueView({...view, name: trimmedInputValue});
    }
    setIsEditing(false);
  };

  const handleOnKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    }
    if (e.key === 'Escape') {
      setInputValue(view.label.trim());
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
    <Tooltip
      title={inputValue}
      disabled={isEditing || isDragging}
      showOnlyOnOverflow
      skipWrapper
    >
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
              if (isActive) {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
            onMouseDown={e => {
              if (isActive) {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
            isActive={isActive}
          >
            {inputValue}
          </UnselectedTabTitle>
        )}
      </motion.div>
    </Tooltip>
  );
}

export default IssueViewNavEditableTitle;

const UnselectedTabTitle = styled('div')<{isActive: boolean}>`
  height: 20px;
  max-width: ${p => (p.isActive ? '325px' : '310px')};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 1px;
  cursor: pointer;
  line-height: 1.5;
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
  line-height: 1.5;

  &,
  &:focus,
  &:active,
  &:hover {
    box-shadow: none;
  }
`;
