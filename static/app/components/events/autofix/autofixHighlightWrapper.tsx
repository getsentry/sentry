import React, {useRef} from 'react';
import {AnimatePresence} from 'framer-motion';

import AutofixHighlightPopup from 'sentry/components/events/autofix/autofixHighlightPopup';
import {useTextSelection} from 'sentry/components/events/autofix/useTextSelection';

interface AutofixHighlightWrapperProps {
  children: React.ReactNode;
  groupId: string;
  runId: string;
  stepIndex: number;
  className?: string;
  isAgentComment?: boolean;
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
}: AutofixHighlightWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selection = useTextSelection(containerRef);

  return (
    <React.Fragment>
      <div ref={containerRef} className={className}>
        {children}
      </div>

      <AnimatePresence>
        {selection && (
          <AutofixHighlightPopup
            selectedText={selection.selectedText}
            referenceElement={selection.referenceElement}
            groupId={groupId}
            runId={runId}
            stepIndex={stepIndex}
            retainInsightCardIndex={retainInsightCardIndex}
            isAgentComment={isAgentComment}
          />
        )}
      </AnimatePresence>
    </React.Fragment>
  );
}
