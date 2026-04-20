import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {useUser} from 'sentry/utils/useUser';
import {AskUserQuestionBlock} from 'sentry/views/seerExplorer/components/askUserQuestionBlock';
import {BlockComponent} from 'sentry/views/seerExplorer/components/blockComponents';
import {EmptyState} from 'sentry/views/seerExplorer/components/emptyState';
import {FileChangeApprovalBlock} from 'sentry/views/seerExplorer/components/fileChangeApprovalBlock';
import {InputSection} from 'sentry/views/seerExplorer/components/inputSection';
import {BlocksContainer} from 'sentry/views/seerExplorer/components/panel/panelContainers';
import {useBlockNavigation} from 'sentry/views/seerExplorer/hooks/useBlockNavigation';
import {usePendingUserInput} from 'sentry/views/seerExplorer/hooks/usePendingUserInput';
import {useSeerExplorer} from 'sentry/views/seerExplorer/hooks/useSeerExplorer';
import type {Block} from 'sentry/views/seerExplorer/types';
import {usePageReferrer} from 'sentry/views/seerExplorer/utils';

// interface ExplorerDrawerContentProps {
//   // isMinimized: boolean;
//   // setIsMinimized: (value: boolean) => void;
// }

export function ExplorerDrawerContent() {
  const {getPageReferrer} = usePageReferrer();

  const [inputValue, setInputValue] = useState('');
  const [focusedBlockIndex, setFocusedBlockIndex] = useState(-1);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Array<HTMLDivElement | null>>([]);
  const blockEnterHandlers = useRef<
    Map<number, (key: 'Enter' | 'ArrowUp' | 'ArrowDown') => boolean>
  >(new Map());
  const hoveredBlockIndex = useRef<number>(-1);
  const userScrolledUpRef = useRef<boolean>(false);
  const allowHoverFocusChange = useRef<boolean>(true);
  const prWidgetButtonRef = useRef<HTMLButtonElement>(null); // TODO:

  // ── Session data ──────────────────────────────────────────────────────────
  const {
    runId,
    sessionData,
    isPolling,
    isError,
    sendMessage,
    deleteFromIndex,
    respondToUserInput,
    createPR,
    interruptRun,
    waitingForInterrupt,
  } = useSeerExplorer();

  const repoPRStates = useMemo(
    () => sessionData?.repo_pr_states ?? {},
    [sessionData?.repo_pr_states]
  );
  const blocks = useMemo(() => sessionData?.blocks || [], [sessionData]);

  const user = useUser();
  const readOnly =
    sessionData?.owner_user_id !== undefined &&
    sessionData.owner_user_id !== null &&
    sessionData.owner_user_id.toString() !== user.id;

  const latestTodoBlockIndex = useMemo(() => {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];
      if (block && Array.isArray(block.todos) && block.todos.length > 0) return i;
    }
    return -1;
  }, [blocks]);

  const isAwaitingUserInput = sessionData?.status === 'awaiting_user_input';
  const pendingInput = sessionData?.pending_user_input;
  const isEmptyState = blocks.length === 0 && !(isAwaitingUserInput && pendingInput);

  // ── Stable callbacks ──────────────────────────────────────────────────────
  const focusInput = useCallback(() => {
    hoveredBlockIndex.current = -1;
    setFocusedBlockIndex(-1);
    textareaRef.current?.focus();
  }, []);

  // ── External open (programmatic openSeerExplorer() calls) ─────────────────
  // TODO: migrate external open event listening to global level
  // const {isWaitingForSessionData} = useExternalOpen({
  //   isVisible,
  //   sendMessage,
  //   startNewSession,
  //   switchToRun,
  //   sessionRunId: runId ?? undefined,
  //   sessionBlocks: sessionData?.blocks,
  //   // onUnminimize: useCallback(() => setIsMinimized(false), [setIsMinimized]), TODO:
  // });

  // ── Pending user input (file approval + questions) ────────────────────────
  const {
    isFileApprovalPending,
    fileApprovalIndex,
    fileApprovalTotalPatches,
    handleFileApprovalApprove,
    handleFileApprovalReject,
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
  } = usePendingUserInput({
    isAwaitingUserInput,
    pendingInput,
    respondToUserInput,
    scrollContainerRef,
    userScrolledUpRef,
  });

  // ── Input handlers ────────────────────────────────────────────────────────
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (readOnly || e.nativeEvent.isComposing) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (inputValue.trim() && !isPolling) {
          sendMessage(inputValue.trim());
          setInputValue('');
          userScrolledUpRef.current = false;
          if (textareaRef.current) textareaRef.current.style.height = 'auto';
        }
      }
    },
    [readOnly, inputValue, isPolling, sendMessage]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    if (focusedBlockIndex !== -1) {
      setFocusedBlockIndex(-1);
      textareaRef.current?.focus();
    }
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const handleInputClick = useCallback(() => {
    focusInput();
    // closeMenu(); //TODO:
  }, [focusInput]);

  // ── Effects ───────────────────────────────────────────────────────────────

  // Track scroll position to detect if user scrolled up
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return undefined;
    const handleScroll = () => {
      const {scrollTop, scrollHeight, clientHeight} = container;
      userScrolledUpRef.current = scrollHeight - scrollTop - clientHeight >= 50;
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll to bottom when new blocks are added, unless user scrolled up
  useEffect(() => {
    if (!userScrolledUpRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [blocks]);

  // Keep blockRefs array trimmed to current blocks length
  useEffect(() => {
    blockRefs.current = blockRefs.current.slice(0, blocks.length);
  }, [blocks]);

  // Reset scroll tracking when focus returns to input (which is at the bottom)
  useEffect(() => {
    if (focusedBlockIndex === -1) {
      setTimeout(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const {scrollTop, scrollHeight, clientHeight} = container;
        if (scrollHeight - scrollTop - clientHeight < 50) {
          userScrolledUpRef.current = false;
        }
      }, 100);
    }
  }, [focusedBlockIndex]);

  // Block keyboard navigation
  useBlockNavigation({
    isOpen: true, // Drawer content is always visible when rendered
    focusedBlockIndex,
    blocks,
    blockRefs,
    textareaRef,
    setFocusedBlockIndex,
    // isMinimized, //TODO:
    isFileApprovalPending,
    isPolling,
    isQuestionPending,
    onDeleteFromIndex: deleteFromIndex,
    // TODO:
    // onKeyPress: (blockIndex, key) => {
    //   const handler = blockEnterHandlers.current.get(blockIndex);
    //   const handled = handler?.(key) ?? false;
    //   if (key === 'Enter' && handled) setIsMinimized(true);
    //   return handled;
    // },
    onNavigate: () => {
      // setIsMinimized(false); //TODO:
      userScrolledUpRef.current = true;
    },
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Fragment>
      <BlocksContainer ref={scrollContainerRef}>
        {' '}
        {/* TODO: onClick={handlePanelBackgroundClick} */}
        {isEmptyState ? (
          <EmptyState isLoading={isPolling} isError={isError} runId={runId} />
        ) : (
          <Fragment>
            {blocks.map((block: Block, index: number) => (
              <BlockComponent
                key={block.id}
                ref={el => {
                  blockRefs.current[index] = el;
                }}
                block={block}
                blockIndex={index}
                runId={runId ?? undefined}
                getPageReferrer={getPageReferrer}
                isAwaitingFileApproval={isFileApprovalPending}
                isAwaitingQuestion={isQuestionPending}
                isLatestTodoBlock={index === latestTodoBlockIndex}
                isLast={
                  index === blocks.length - 1 && !(isAwaitingUserInput && pendingInput)
                }
                isFocused={focusedBlockIndex === index}
                isPolling={isPolling}
                readOnly={readOnly}
                onClick={() => {
                  textareaRef.current?.blur();
                  setFocusedBlockIndex(index);
                }}
                onMouseEnter={() => {
                  if (
                    // isMenuOpen ||  //TODO:
                    hoveredBlockIndex.current === index ||
                    !allowHoverFocusChange.current
                  ) {
                    return;
                  }
                  hoveredBlockIndex.current = index;
                  setFocusedBlockIndex(index);
                  textareaRef.current?.blur();
                }}
                onMouseLeave={() => {
                  if (hoveredBlockIndex.current === index) hoveredBlockIndex.current = -1;
                }}
                onDelete={() => {
                  deleteFromIndex(index);
                  focusInput();
                }}
                onNavigate={() => {}} // TODO: setIsMinimized(true)
                onRegisterEnterHandler={handler => {
                  blockEnterHandlers.current.set(index, handler);
                }}
              />
            ))}
            {!readOnly &&
              isFileApprovalPending &&
              fileApprovalIndex < fileApprovalTotalPatches && (
                <FileChangeApprovalBlock
                  currentIndex={fileApprovalIndex}
                  isLast
                  pendingInput={pendingInput!}
                />
              )}
            {!readOnly && isQuestionPending && currentQuestion && (
              <AskUserQuestionBlock
                currentQuestion={currentQuestion}
                customText={customText}
                isLast
                isOtherSelected={isOtherSelected}
                onCustomTextChange={handleQuestionCustomTextChange}
                onSelectOption={handleQuestionSelectOption}
                questionIndex={questionIndex}
                selectedOption={selectedOption}
              />
            )}
          </Fragment>
        )}
      </BlocksContainer>
      <InputSection
        blocks={blocks}
        enabled={!readOnly}
        inputValue={inputValue}
        waitingForInterrupt={waitingForInterrupt}
        isVisible // Drawer content is always visible when rendered
        isMinimized={false} // Drawer doesn't have a minimized state
        isPolling={isPolling}
        onClear={() => setInputValue('')}
        onCreatePR={createPR}
        onInputChange={handleInputChange}
        onInputClick={handleInputClick}
        onInterrupt={interruptRun}
        onKeyDown={handleInputKeyDown}
        onPRWidgetClick={() => {} /* TODO: openPRWidget */}
        prWidgetButtonRef={prWidgetButtonRef /* TODO */}
        repoPRStates={repoPRStates}
        textAreaRef={textareaRef}
        fileApprovalActions={
          isFileApprovalPending && fileApprovalIndex < fileApprovalTotalPatches
            ? {
                currentIndex: fileApprovalIndex,
                totalPatches: fileApprovalTotalPatches,
                onApprove: handleFileApprovalApprove,
                onReject: handleFileApprovalReject,
              }
            : undefined
        }
        questionActions={
          isQuestionPending && currentQuestion
            ? {
                currentIndex: questionIndex,
                totalQuestions,
                canSubmit: canSubmitQuestion,
                onNext: handleQuestionNext,
                onBack: handleQuestionBack,
                onMoveUp: handleQuestionMoveUp,
                onMoveDown: handleQuestionMoveDown,
              }
            : undefined
        }
      />
    </Fragment>
  );
}
