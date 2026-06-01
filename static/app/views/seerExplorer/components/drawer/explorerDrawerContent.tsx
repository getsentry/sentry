import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {useDrawerContentContext} from '@sentry/scraps/drawer';
import {Stack} from '@sentry/scraps/layout';
import {usePictureInPicture} from '@sentry/scraps/pictureInPicture';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {SEER_AGENTS_PROJECT_ID} from 'sentry/constants';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useDeferredSessionStorage} from 'sentry/utils/useDeferredSessionStorage';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';
import {getConversationsUrlForExternalUse} from 'sentry/views/explore/conversations/utils/urlParams';
import {AskUserQuestionBlock} from 'sentry/views/seerExplorer/components/askUserQuestionBlock';
import {BlockComponent} from 'sentry/views/seerExplorer/components/chat';
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

export const INPUT_STORAGE_KEY_PREFIX = 'seer-explorer-draft';

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
  const {onClose: closeDrawer = () => {}} = useDrawerContentContext();
  const {
    pipWindow,
    isSupported: isPipSupported,
    requestPipWindow,
    closePipWindow,
  } = usePictureInPicture();
  const isPoppedOut = pipWindow !== null;

  const rootRef = useRef<HTMLDivElement>(null);

  const handleTogglePictureInPicture = () => {
    if (isPoppedOut) {
      // Re-dock back into the drawer.
      closePipWindow();
      return;
    }
    // Match the popped-out window to the current (resizable) drawer width.
    const drawerWidth = rootRef.current?.getBoundingClientRect().width;
    requestPipWindow({
      width: drawerWidth ? Math.round(drawerWidth) : 480,
      height: Math.round(window.innerHeight * 0.9),
      // Open at the browser's default placement rather than wherever the window
      // happened to be left last time.
      preferInitialWindowPlacement: true,
    })
      .then(() => closeDrawer())
      .catch(() => {
        // Failed to open the PiP window — keep the drawer open.
      });
  };

  const [showThinking, setShowThinking] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Array<HTMLDivElement | null>>([]);
  const userScrolledUpRef = useRef(false);
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
    errorStatusCode,
    isTimedOut,
    sendMessage,
    startNewSession,
    switchToRun,
    respondToUserInput,
    createPR,
    interruptRun,
    hasSentInterrupt,
    overrideCtxEngEnable,
    setOverrideCtxEngEnable,
    setOverrideCodeModeEnable,
  } = useSeerExplorer();

  // Persist the input draft per-run so drawer closes / run switches
  // don't lose the user's in-progress text.
  const {
    value: inputValue,
    setValue: setInputValue,
    reset: clearInput,
  } = useDeferredSessionStorage(
    runId === null ? null : `${INPUT_STORAGE_KEY_PREFIX}:${runId}`,
    ''
  );

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
    sendMessage(query, blocks.length);
  }, [initialQuery, isEmptyState, sendMessage, blocks.length]);

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
    if (runId === null) {
      return;
    }
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
  const conversationsUrl = useMemo(() => {
    if (runId === null) {
      return;
    }
    let minTs = Infinity;
    let maxTs = -Infinity;
    for (const block of blocks) {
      const ts = Date.parse(block.timestamp);
      if (Number.isNaN(ts)) {
        continue;
      }
      if (ts < minTs) {
        minTs = ts;
      }
      if (ts > maxTs) {
        maxTs = ts;
      }
    }
    return getConversationsUrlForExternalUse('sentry', runId, {
      start: minTs === Infinity ? undefined : new Date(minTs).toISOString(),
      end: maxTs === -Infinity ? undefined : new Date(maxTs).toISOString(),
      project: SEER_AGENTS_PROJECT_ID,
    });
  }, [runId, blocks]);

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
    clearInput,
    inputValue,
    focusInput,
    textAreaRef: textareaRef,
    panelSize: 'max',
    slashCommandHandlers: {
      onNew: startNewSession,
      onFeedback: openFeedbackForm ? handleFeedback : undefined,
      onLangfuse: langfuseUrl ? handleOpenLangfuse : undefined,
      onConversations: conversationsUrl ? handleOpenConversations : undefined,
      onCodeMode: organization?.features.includes('seer-explorer-code-mode-tools')
        ? setOverrideCodeModeEnable
        : undefined,
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
  const canSendMessage = !readOnly && !isPolling && !!inputValue.trim();
  const handleSend = useCallback(() => {
    if (!canSendMessage) {
      return;
    }
    sendMessage(inputValue.trim(), blocks.length);
    clearInput();
    userScrolledUpRef.current = false;
  }, [canSendMessage, inputValue, sendMessage, blocks.length, clearInput]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing) {
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (isPoppedOut) {
          closePipWindow();
        } else {
          closeDrawer();
        }
      }
    },
    [handleSend, closeDrawer, isPoppedOut, closePipWindow]
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
    return;
  }, []);

  // Update block refs array when blocks change
  useEffect(() => {
    blockRefs.current = blockRefs.current.slice(0, blocks.length);
  }, [blocks]);

  // Deep link effect
  useSeerExplorerDeepLink({callback: switchToRun});

  // Track when a session times out
  const prevIsTimedOutRef = useRef(false);
  useEffect(() => {
    if (isTimedOut && !prevIsTimedOutRef.current) {
      trackAnalytics('seer.explorer.timed_out', {organization, run_id: runId});
    }
    prevIsTimedOutRef.current = isTimedOut;
  }, [isTimedOut, organization, runId]);

  // Interrupt button and placeholder state
  const interruptState =
    isPolling && hasSentInterrupt
      ? 'requested'
      : isPolling
        ? 'can-interrupt'
        : hasSentInterrupt
          ? 'completed'
          : 'disabled';

  return (
    <DrawerContentContainer ref={rootRef} data-seer-explorer-root="">
      <ExplorerDrawerHeader
        disableNewChatButton={runId === null}
        onNewChatClick={() => {
          startNewSession();
          focusInput();
        }}
        onChangeSession={switchToRun}
        onCopySessionClick={copySessionEnabled ? copySessionToClipboard : undefined}
        onCopyLinkClick={runId === null ? undefined : handleCopyLink}
        overrideCtxEngEnable={overrideCtxEngEnable}
        onOverrideCtxEngEnableToggle={() => setOverrideCtxEngEnable(v => !v)}
        showContextEngineToggle={
          !!organization?.features.includes(
            'seer-explorer-context-engine-fe-override-ui-flag'
          )
        }
        showThinking={showThinking}
        onShowThinkingToggle={() => setShowThinking(v => !v)}
        showThinkingToggle={
          !!organization?.features.includes('seer-explorer-thinking-blocks')
        }
        isPipSupported={isPipSupported}
        isPoppedOut={isPoppedOut}
        onTogglePictureInPicture={handleTogglePictureInPicture}
      />
      {menu}
      <BlocksContainer ref={scrollContainerRef} onClick={handleBlocksClick}>
        {isEmptyState ? (
          <EmptyState
            isLoading={isPolling}
            isError={isError}
            errorStatusCode={errorStatusCode}
            runId={runId}
            onSuggestionClick={readOnly ? undefined : sendMessage}
          />
        ) : (
          <Fragment>
            {blocks.map((block: Block, index: number) => {
              // For slide-in animation that runs on mount. Avoid running this twice on user blocks when blocks are hydrated.
              const key = block.message.role === 'user' ? `user-${index}` : block.id;

              return (
                <BlockComponent
                  key={key}
                  ref={el => {
                    blockRefs.current[index] = el;
                  }}
                  block={block}
                  blockIndex={index}
                  blocks={blocks}
                  runId={runId ?? undefined}
                  getPageReferrer={getPageReferrer}
                  interactionPending={isFileApprovalPending || isQuestionPending}
                  readOnly={readOnly}
                  showThinking={showThinking}
                />
              );
            })}
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
        canSendMessage={canSendMessage}
        interruptState={interruptState}
        isTimedOut={isTimedOut}
        onClear={clearInput}
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
  contain: inline-size;
  container-type: inline-size;
  container-name: seer-explorer-root;
`;
