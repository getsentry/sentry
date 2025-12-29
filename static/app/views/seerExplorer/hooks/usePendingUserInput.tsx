import {useCallback, useEffect, useMemo, useState} from 'react';

import {t} from 'sentry/locale';
import type {PendingUserInput} from 'sentry/views/seerExplorer/hooks/useSeerExplorer';

interface PendingFilePatch {
  patch: any;
  repo_name: string;
}

interface FileChangeApprovalData {
  patches: PendingFilePatch[];
}

interface QuestionOption {
  description: string;
  label: string;
}

export interface Question {
  options: QuestionOption[];
  question: string;
}

interface AskUserQuestionData {
  questions: Question[];
}

interface UsePendingUserInputProps {
  isAwaitingUserInput: boolean;
  pendingInput: PendingUserInput | null | undefined;
  respondToUserInput: (
    inputId: string,
    data: {decisions: boolean[]} | {answers: string[]}
  ) => void;
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

  // ===== Ask User Question State =====
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionAnswers, setQuestionAnswers] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<number>(0); // Start with first option selected
  const [customText, setCustomText] = useState('');

  // Reset question state when pendingInput changes
  useEffect(() => {
    if (pendingInputType === 'ask_user_question') {
      setQuestionIndex(0);
      setQuestionAnswers([]);
      setSelectedOption(0);
      setCustomText('');
    }
  }, [pendingInput?.id, pendingInputType]);

  // Get question data
  const questionData = useMemo(() => {
    if (!pendingInput || pendingInputType !== 'ask_user_question') {
      return null;
    }
    return pendingInput.data as AskUserQuestionData;
  }, [pendingInput, pendingInputType]);

  const questions = useMemo(() => questionData?.questions ?? [], [questionData]);
  const totalQuestions = useMemo(() => questions.length, [questions]);
  const currentQuestion = questions[questionIndex];
  const optionsCount = currentQuestion?.options.length ?? 0;
  // "Other" (custom text input) is the last option (index = optionsCount)
  const isOtherSelected = selectedOption === optionsCount;

  // Auto-scroll to question block when it appears
  useEffect(() => {
    if (
      isAwaitingUserInput &&
      pendingInput &&
      pendingInputType === 'ask_user_question' &&
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

  const handleQuestionNext = useCallback(() => {
    // Determine the answer string
    let answer: string;
    if (isOtherSelected) {
      answer = customText.trim() || t('(No response provided)');
    } else if (currentQuestion && selectedOption < currentQuestion.options.length) {
      answer = currentQuestion.options[selectedOption]!.label;
    } else {
      return;
    }

    const newAnswers = [...questionAnswers, answer];
    const nextIndex = questionIndex + 1;

    if (nextIndex >= totalQuestions) {
      // All questions answered - submit
      if (pendingInput?.id) {
        respondToUserInput(pendingInput.id, {
          answers: newAnswers,
        });
      }
    } else {
      // Move to next question
      setQuestionAnswers(newAnswers);
      setQuestionIndex(nextIndex);
      setSelectedOption(0); // Reset to first option
      setCustomText('');
    }
  }, [
    isOtherSelected,
    customText,
    currentQuestion,
    selectedOption,
    questionAnswers,
    questionIndex,
    totalQuestions,
    pendingInput?.id,
    respondToUserInput,
  ]);

  const handleQuestionBack = useCallback(() => {
    if (questionIndex > 0) {
      const prevIndex = questionIndex - 1;
      const prevAnswer = questionAnswers[prevIndex];
      const prevQuestion = questions[prevIndex];

      // Try to restore the previous selection
      let prevSelectedOption = 0;
      let prevCustomText = '';

      if (prevQuestion && prevAnswer) {
        const optionIndex = prevQuestion.options.findIndex(o => o.label === prevAnswer);
        if (optionIndex === -1) {
          // Was custom text
          prevSelectedOption = prevQuestion.options.length; // "Other" index
          prevCustomText = prevAnswer;
        } else {
          prevSelectedOption = optionIndex;
        }
      }

      setQuestionIndex(prevIndex);
      setQuestionAnswers(questionAnswers.slice(0, prevIndex));
      setSelectedOption(prevSelectedOption);
      setCustomText(prevCustomText);
    }
  }, [questionIndex, questionAnswers, questions]);

  const handleQuestionSelectOption = useCallback((index: number) => {
    setSelectedOption(index);
  }, []);

  const handleQuestionMoveUp = useCallback(() => {
    setSelectedOption(prev => (prev > 0 ? prev - 1 : optionsCount)); // Wrap to "Other"
  }, [optionsCount]);

  const handleQuestionMoveDown = useCallback(() => {
    setSelectedOption(prev => (prev < optionsCount ? prev + 1 : 0)); // Wrap to first
  }, [optionsCount]);

  const handleQuestionCustomTextChange = useCallback((text: string) => {
    setCustomText(text);
  }, []);

  // Check if we're currently awaiting a question answer
  const isQuestionPending =
    isAwaitingUserInput && pendingInputType === 'ask_user_question';

  // Can submit current question (always true for options, need text for "Other")
  const canSubmitQuestion = !isOtherSelected || customText.trim().length > 0;

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

    // Ask user question specific
    isQuestionPending,
    questionIndex,
    totalQuestions,
    currentQuestion,
    selectedOption,
    isOtherSelected,
    customText,
    canSubmitQuestion,
    handleQuestionNext,
    handleQuestionBack,
    handleQuestionSelectOption,
    handleQuestionMoveUp,
    handleQuestionMoveDown,
    handleQuestionCustomTextChange,
  };
}
