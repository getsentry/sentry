import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {useDrawer} from '@sentry/scraps/drawer';
import {Stack} from '@sentry/scraps/layout';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';
import {getConversationsUrl} from 'sentry/views/explore/conversations/utils/urlParams';
import {AskUserQuestionBlock} from 'sentry/views/seerExplorer/components/askUserQuestionBlock';
import {BlockComponent} from 'sentry/views/seerExplorer/components/blockComponents';
import {ExplorerDrawerHeader} from 'sentry/views/seerExplorer/components/drawer/explorerDrawerHeader';
import {EmptyState} from 'sentry/views/seerExplorer/components/emptyState';
import {useExplorerMenu} from 'sentry/views/seerExplorer/components/explorerMenu';
import {FileChangeApprovalBlock} from 'sentry/views/seerExplorer/components/fileChangeApprovalBlock';
import {InputSection} from 'sentry/views/seerExplorer/components/inputSection';
import {usePRWidgetData} from 'sentry/views/seerExplorer/components/prWidget';
import {usePendingUserInput} from 'sentry/views/seerExplorer/hooks/usePendingUserInput';
import {useSeerExplorer} from 'sentry/views/seerExplorer/hooks/useSeerExplorer';
import type {Block} from 'sentry/views/seerExplorer/types';
import {
  getExplorerFeedbackOptions,
  getExplorerUrl,
  getLangfuseUrl,
  useCopySessionDataToClipboard,
  useSeerExplorerDeepLink,
} from 'sentry/views/seerExplorer/utils';

export function ExplorerDrawerContent({
  getPageReferrer,
  initialQuery,
}: {
  getPageReferrer: () => string;
  initialQuery?: string;
}) {
  const organization = useOrganization({allowNull: true});
  const {projects} = useProjects();
  const user = useUser();
  const {closeDrawer} = useDrawer();

  const [inputValue, setInputValue] = useState('');
  const [showThinking, setShowThinking] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Array<HTMLDivElement | null>>([]);
  const userScrolledUpRef = useRef<boolean>(false);
  const prWidgetButtonRef = useRef<HTMLButtonElement>(null);

  const focusInput = useCallback(() => {
    textareaRef.current?.focus();
  }, []);

  // - Session data and mutators ----------------------------------------------
  const {
    runId,
    sessionData,
    isPolling,
    isError,
    sendMessage,
    startNewSession,
    switchToRun,
    respondToUserInput,
    createPR,
    interruptRun,
    waitingForInterrupt,
    overrideCtxEngEnable,
    setOverrideCtxEngEnable,
    overrideCodeModeEnable,
    setOverrideCodeModeEnable,
  } = useSeerExplorer();

  const readOnly =
    sessionData?.owner_user_id !== undefined &&
    sessionData.owner_user_id !== null &&
    sessionData.owner_user_id.toString() !== user.id;

  const blocks = useMemo(() => sessionData?.blocks || [], [sessionData?.blocks]);
  const isAwaitingUserInput = sessionData?.status === 'awaiting_user_input';
  const pendingInput = sessionData?.pending_user_input;
  const isEmptyState = blocks.length === 0 && !(isAwaitingUserInput && pendingInput);

  // Auto-submit the initial query forwarded from the command palette, but only
  // if the session is still empty (don't clobber an active run). Tracking the
  // last submitted query string (not just a boolean) lets a new query trigger
  // a fresh submission when the drawer is reopened with a different query.
  const lastAutoSubmittedQueryRef = useRef<string | null>(null);
  useEffect(() => {
    const query = initialQuery?.trim();
    if (!query || !isEmptyState || lastAutoSubmittedQueryRef.current === query) {
      return;
    }
    lastAutoSubmittedQueryRef.current = query;
    sendMessage(query);
  }, [initialQuery, isEmptyState, sendMessage]);

  const latestTodoBlockIndex = useMemo(() => {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];
      if (block && Array.isArray(block.todos) && block.todos.length > 0) return i;
    }
    return -1;
  }, [blocks]);

  // - Pending user input (file approval + questions) -------------------------
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

  // - Topbar, menu, and slash command handlers -------------------------------
  const copySessionEnabled = runId !== null && !!organization?.slug;
  const {copySessionToClipboard} = useCopySessionDataToClipboard({
    blocks: sessionData?.blocks,
    status: sessionData?.status,
    organization,
    projects,
    enabled: copySessionEnabled,
  });

  const handleCopyLink = useCallback(async () => {
    if (runId === null) return;
    try {
      const url = getExplorerUrl(runId);
      await navigator.clipboard.writeText(url);
      addSuccessMessage('Copied link to current chat');
      trackAnalytics('seer.explorer.session_link_copied', {organization});
    } catch {
      addErrorMessage('Failed to copy link to current chat');
    }
  }, [runId, organization]);

  const langfuseUrl = runId ? getLangfuseUrl(runId) : undefined;
  const conversationsUrl = runId ? getConversationsUrl('sentry', runId) : undefined;

  const handleOpenLangfuse = useCallback(() => {
    // Command handler. Disabled in slash command menu for non-employees
    if (langfuseUrl) {
      window.open(langfuseUrl, '_blank');
    }
  }, [langfuseUrl]);

  const handleOpenConversations = useCallback(() => {
    // Command handler. Disabled in slash command menu for non-employees
    if (conversationsUrl) {
      window.open(conversationsUrl, '_blank');
    }
  }, [conversationsUrl]);

  const openFeedbackForm = useFeedbackForm();
  const handleFeedback = useCallback(() => {
    if (openFeedbackForm) {
      const feedbackOptions = getExplorerFeedbackOptions(runId);
      openFeedbackForm(feedbackOptions);
    }
  }, [openFeedbackForm, runId]);

  // - Pop-up menu component --------------------------------------------------

  // Extract repo_pr_states from session
  const repoPRStates = useMemo(
    () => sessionData?.repo_pr_states ?? {},
    [sessionData?.repo_pr_states]
  );

  // Get PR widget data for menu
  const {menuItems: prWidgetItems, menuFooter: prWidgetFooter} = usePRWidgetData({
    blocks,
    repoPRStates,
    onCreatePR: createPR,
  });

  // Menu component
  const {menu, closeMenu, openPRWidget} = useExplorerMenu({
    clearInput: () => setInputValue(''),
    inputValue,
    focusInput,
    textAreaRef: textareaRef,
    panelSize: 'max',
    slashCommandHandlers: {
      onNew: startNewSession,
      onFeedback: openFeedbackForm ? handleFeedback : undefined,
      onLangfuse: langfuseUrl ? handleOpenLangfuse : undefined,
      onConversations: conversationsUrl ? handleOpenConversations : undefined,
    },
    inputAnchorRef: textareaRef,
    prWidgetAnchorRef: prWidgetButtonRef,
    prWidgetItems,
    prWidgetFooter,
  });

  const handleBlocksClick = useCallback(() => {
    closeMenu();
  }, [closeMenu]);

  // - Input section handlers -------------------------------------------------
  const handleSend = useCallback(() => {
    if (readOnly || isPolling || !inputValue.trim()) {
      return;
    }
    sendMessage(inputValue.trim());
    setInputValue('');
    userScrolledUpRef.current = false;
  }, [readOnly, inputValue, isPolling, sendMessage]);

  const canInterrupt = sessionData?.status === 'processing';

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (readOnly || e.nativeEvent.isComposing) {
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeDrawer();
      }
    },
    [readOnly, handleSend, closeDrawer]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    textareaRef.current?.focus();
  };

  const handleInputClick = useCallback(() => {
    focusInput();
    closeMenu();
  }, [focusInput, closeMenu]);

  // - Scroll effects ---------------------------------------------------------

  useEffect(() => {
    // Scroll to bottom and focus input when drawer opens
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
      textareaRef.current?.focus();
    }, 100);
  }, []);

  // Auto-scroll to bottom when new blocks are added, but only if user hasn't scrolled up
  useEffect(() => {
    if (!userScrolledUpRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [blocks]);

  // Track scroll position to detect if user scrolled up
  useEffect(() => {
    const handleScroll = () => {
      const container = scrollContainerRef.current;
      if (!container) {
        return;
      }

      const {scrollTop, scrollHeight, clientHeight} = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px threshold

      // If user is at/near bottom, mark that they haven't scrolled up
      if (isAtBottom) {
        userScrolledUpRef.current = false;
      } else {
        userScrolledUpRef.current = true;
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
    return undefined;
  }, []);

  // - Keyboard listeners -----------------------------------------------------

  // Update block refs array when blocks change
  useEffect(() => {
    blockRefs.current = blockRefs.current.slice(0, blocks.length);
  }, [blocks]);

  // - Deep link effect -------------------------------------------------------
  useSeerExplorerDeepLink({callback: switchToRun});

  return (
    <DrawerContentContainer data-seer-explorer-root="">
      <ExplorerDrawerHeader
        onNewChatClick={() => {
          startNewSession();
          focusInput();
        }}
        onChangeSession={switchToRun}
        isEmptyState={isEmptyState}
        onCopySessionClick={copySessionEnabled ? copySessionToClipboard : undefined}
        onCopyLinkClick={runId === null ? undefined : handleCopyLink}
        overrideCtxEngEnable={overrideCtxEngEnable}
        onOverrideCtxEngEnableToggle={() => setOverrideCtxEngEnable(v => !v)}
        showContextEngineToggle={
          !!organization?.features.includes(
            'seer-explorer-context-engine-fe-override-ui-flag'
          )
        }
        overrideCodeModeEnable={overrideCodeModeEnable}
        onOverrideCodeModeEnableToggle={() => setOverrideCodeModeEnable(v => !v)}
        showCodeModeToggle={
          !!organization?.features.includes('seer-explorer-code-mode-tools')
        }
        showThinking={showThinking}
        onShowThinkingToggle={() => setShowThinking(v => !v)}
        showThinkingToggle={
          !!organization?.features.includes('seer-explorer-thinking-blocks')
        }
      />
      {menu}
      <BlocksContainer ref={scrollContainerRef} onClick={handleBlocksClick}>
        {isEmptyState ? (
          <EmptyState
            isLoading={isPolling}
            isError={isError}
            runId={runId}
            onSuggestionClick={readOnly ? undefined : sendMessage}
          />
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
                readOnly={readOnly}
                showThinking={showThinking}
                onNavigate={undefined} // TODO: close drawer on link navigate? useDrawerContentContext
              />
            ))}
            {!readOnly &&
              isFileApprovalPending &&
              fileApprovalIndex < fileApprovalTotalPatches && (
                <FileChangeApprovalBlock
                  currentIndex={fileApprovalIndex}
                  pendingInput={pendingInput!}
                />
              )}
            {!readOnly && isQuestionPending && currentQuestion && (
              <AskUserQuestionBlock
                currentQuestion={currentQuestion}
                customText={customText}
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
        canInterrupt={canInterrupt} // TODO: update when adding timeouts
        waitingForInterrupt={waitingForInterrupt}
        isMinimized={false} // Drawer doesn't have a minimized state
        isVisible // Drawer content is always visible when rendered
        onClear={() => setInputValue('')}
        onCreatePR={createPR}
        onInputChange={handleInputChange}
        onInputClick={handleInputClick}
        onInterrupt={interruptRun}
        onKeyDown={handleInputKeyDown}
        onSend={handleSend}
        onPRWidgetClick={openPRWidget}
        prWidgetButtonRef={prWidgetButtonRef}
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
    </DrawerContentContainer>
  );
}

const BlocksContainer = styled(Stack)`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
`;

const DrawerContentContainer = styled('div')`
  width: 100%;
  height: 100%;
  background: ${p => p.theme.tokens.background.primary};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;
