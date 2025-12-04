import {useCallback, useEffect, useMemo, useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {PendingUserInput} from 'sentry/views/seerExplorer/hooks/useSeerExplorer';

interface PendingFilePatch {
  patch: any;
  repo_name: string;
}

interface FileChangeApprovalData {
  patches: PendingFilePatch[];
}

interface UsePendingUserInputProps {
  isAwaitingUserInput: boolean;
  pendingInput: PendingUserInput | null | undefined;
  respondToUserInput: (inputId: string, data: {decisions: boolean[]}) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  userScrolledUpRef: React.MutableRefObject<boolean>;
}

export function usePendingUserInput({
  isAwaitingUserInput,
  pendingInput,
  respondToUserInput,
  scrollContainerRef,
  userScrolledUpRef,
}: UsePendingUserInputProps) {
  const pendingInputType = pendingInput?.input_type;

  // File approval state
  const [fileApprovalIndex, setFileApprovalIndex] = useState(0);
  const [fileApprovalDecisions, setFileApprovalDecisions] = useState<boolean[]>([]);

  // Reset file approval state when pendingInput changes
  useEffect(() => {
    if (pendingInputType === 'file_change_approval') {
      setFileApprovalIndex(0);
      setFileApprovalDecisions([]);
    }
  }, [pendingInput?.id, pendingInputType]);

  // Get file approval data
  const fileApprovalData = useMemo(() => {
    if (!pendingInput || pendingInputType !== 'file_change_approval') {
      return null;
    }
    return pendingInput.data as FileChangeApprovalData;
  }, [pendingInput, pendingInputType]);

  const fileApprovalPatches = fileApprovalData?.patches ?? [];
  const fileApprovalTotalPatches = fileApprovalPatches.length;

  // Auto-scroll to file approval block when it appears
  useEffect(() => {
    if (
      isAwaitingUserInput &&
      pendingInput &&
      pendingInputType === 'file_change_approval' &&
      scrollContainerRef.current
    ) {
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
          userScrolledUpRef.current = false;
        }
      }, 150);
    }
  }, [
    isAwaitingUserInput,
    pendingInput,
    pendingInputType,
    scrollContainerRef,
    userScrolledUpRef,
  ]);

  const handleFileApprovalDecision = useCallback(
    (approved: boolean) => {
      const newDecisions = [...fileApprovalDecisions, approved];
      const nextIndex = fileApprovalIndex + 1;

      setFileApprovalDecisions(newDecisions);
      setFileApprovalIndex(nextIndex);

      if (nextIndex >= fileApprovalTotalPatches) {
        // All patches reviewed - submit to backend
        const allApproved = newDecisions.every(d => d);
        const countRejected = newDecisions.filter(d => !d).length;
        if (!allApproved) {
          addErrorMessage(
            t(
              'You rejected %s change(s). Tell Seer what to do instead to continue.',
              countRejected
            )
          );
        }
        if (pendingInput?.id) {
          respondToUserInput(pendingInput.id, {
            decisions: newDecisions,
          });
        }
      }
    },
    [
      fileApprovalDecisions,
      fileApprovalIndex,
      fileApprovalTotalPatches,
      pendingInput?.id,
      respondToUserInput,
    ]
  );

  const handleFileApprovalApprove = useCallback(
    () => handleFileApprovalDecision(true),
    [handleFileApprovalDecision]
  );

  const handleFileApprovalReject = useCallback(
    () => handleFileApprovalDecision(false),
    [handleFileApprovalDecision]
  );

  // Check if we're currently awaiting file approval
  const isFileApprovalPending =
    isAwaitingUserInput && pendingInputType === 'file_change_approval';

  return {
    // Generic pending input info
    pendingInputType,
    isPending: isAwaitingUserInput && !!pendingInput,

    // File approval specific
    isFileApprovalPending,
    fileApprovalIndex,
    fileApprovalTotalPatches,
    fileApprovalPatches,
    handleFileApprovalApprove,
    handleFileApprovalReject,
  };
}
