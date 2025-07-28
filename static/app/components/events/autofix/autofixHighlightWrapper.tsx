import React, {useEffect, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence} from 'framer-motion';

import AutofixHighlightPopup from 'sentry/components/events/autofix/autofixHighlightPopup';
import {useTextSelection} from 'sentry/components/events/autofix/useTextSelection';
import {t} from 'sentry/locale';

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
  const selection = useTextSelection(containerRef);

  const [shouldPersist, setShouldPersist] = useState(false);
  const lastSelectedText = useRef<string | null>(null);
  const lastReferenceElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (selection) {
      lastSelectedText.current = selection.selectedText;
      lastReferenceElement.current = selection.referenceElement;
    }
  }, [selection]);

  return (
    <React.Fragment>
      <Wrapper
        ref={containerRef}
        className={className}
        isSelected={!!selection}
        title={selection ? undefined : t('Click to chat about this with Seer')}
      >
        {children}
      </Wrapper>

      <AnimatePresence>
        {(selection || shouldPersist) && (
          <AutofixHighlightPopup
            selectedText={selection?.selectedText ?? lastSelectedText.current ?? ''}
            referenceElement={selection?.referenceElement ?? lastReferenceElement.current}
            groupId={groupId}
            runId={runId}
            stepIndex={stepIndex}
            retainInsightCardIndex={retainInsightCardIndex}
            isAgentComment={isAgentComment}
            blockName={displayName}
            onShouldPersistChange={setShouldPersist}
          />
        )}
      </AnimatePresence>
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
