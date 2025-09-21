import React, {useCallback, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

interface AutofixHighlightWrapperProps {
  children: React.ReactNode;
  groupId: string;
  runId: string;
  stepIndex: number;
  className?: string;
  displayName?: string;
  isAgentComment?: boolean;
  ref?: React.RefObject<HTMLDivElement | null>;
  retainInsightCardIndex?: number | null;
}

/**
 * A wrapper component that handles text selection and renders AutofixHighlightPopup
 * when text is selected within its children.
 */
export function AutofixHighlightWrapper({
  children,
  groupId,
  runId,
  stepIndex,
  retainInsightCardIndex = null,
  isAgentComment = false,
  className,
  displayName,
  ref,
}: AutofixHighlightWrapperProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = ref || internalRef;

  const handleClick = useCallback(() => {
    const text = containerRef.current?.textContent?.trim() || '';
    if (!text) {
      return;
    }

    const detail = {
      selectedText: text,
      displayName,
      groupId,
      runId,
      stepIndex,
      retainInsightCardIndex,
      isAgentComment,
    } as const;

    window.dispatchEvent(new CustomEvent('autofix:selected', {detail}));
  }, [
    containerRef,
    displayName,
    groupId,
    runId,
    stepIndex,
    retainInsightCardIndex,
    isAgentComment,
  ]);

  return (
    <React.Fragment>
      <Wrapper
        ref={containerRef}
        className={className}
        onClick={handleClick}
        isSelected={false}
      >
        {children}
      </Wrapper>
    </React.Fragment>
  );
}

const Wrapper = styled('div')<{isSelected: boolean}>`
  &:hover {
    ${p =>
      !p.isSelected &&
      css`
        cursor: pointer;
      `};
  }
`;
