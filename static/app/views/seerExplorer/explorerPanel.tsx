import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {User} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';
import AskUserQuestionBlock from 'sentry/views/seerExplorer/askUserQuestionBlock';
import BlockComponent from 'sentry/views/seerExplorer/blockComponents';
import EmptyState from 'sentry/views/seerExplorer/emptyState';
import {useExplorerMenu} from 'sentry/views/seerExplorer/explorerMenu';
import FileChangeApprovalBlock from 'sentry/views/seerExplorer/fileChangeApprovalBlock';
import {useBlockNavigation} from 'sentry/views/seerExplorer/hooks/useBlockNavigation';
import {usePanelSizing} from 'sentry/views/seerExplorer/hooks/usePanelSizing';
import {usePendingUserInput} from 'sentry/views/seerExplorer/hooks/usePendingUserInput';
import {useSeerExplorer} from 'sentry/views/seerExplorer/hooks/useSeerExplorer';
import InputSection from 'sentry/views/seerExplorer/inputSection';
import {useExternalOpen} from 'sentry/views/seerExplorer/openSeerExplorer';
import PanelContainers, {
  BlocksContainer,
} from 'sentry/views/seerExplorer/panelContainers';
import {usePRWidgetData} from 'sentry/views/seerExplorer/prWidget';
import TopBar from 'sentry/views/seerExplorer/topBar';
import type {Block} from 'sentry/views/seerExplorer/types';
import {useExplorerPanel} from 'sentry/views/seerExplorer/useExplorerPanel';
import {
  getExplorerUrl,
  getLangfuseUrl,
  useCopySessionDataToClipboard,
  usePageReferrer,
} from 'sentry/views/seerExplorer/utils';

function ExplorerPanel() {
  const {isOpen: isVisible} = useExplorerPanel();
  const {getPageReferrer} = usePageReferrer();
  const organization = useOrganization({allowNull: true});
  const {projects} = useProjects();

  const [inputValue, setInputValue] = useState('');
  const [focusedBlockIndex, setFocusedBlockIndex] = useState(-1); // -1 means input is focused
  const [isMinimized, setIsMinimized] = useState(false); // state for slide-down
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Array<HTMLDivElement | null>>([]);
  const blockEnterHandlers = useRef<
    Map<number, (key: 'Enter' | 'ArrowUp' | 'ArrowDown') => boolean>
  >(new Map());
  const panelRef = useRef<HTMLDivElement>(null);
  const hoveredBlockIndex = useRef<number>(-1);
  const userScrolledUpRef = useRef<boolean>(false);
  const allowHoverFocusChange = useRef<boolean>(true);
  const sessionHistoryButtonRef = useRef<HTMLButtonElement>(null);
  const prWidgetButtonRef = useRef<HTMLButtonElement>(null);

  const {panelSize, handleMaxSize, handleMedSize} = usePanelSizing();

  // Panel opened analytic
  useEffect(() => {
    if (isVisible && !isMinimized) {
      trackAnalytics('seer.explorer.global_panel.opened', {
        referrer: getPageReferrer(),
        organization,
      });
    }
  }, [isVisible, isMinimized, organization, getPageReferrer]);

  // Session data and management
  const {
    runId,
    sessionData,
    sendMessage,
    deleteFromIndex,
    startNewSession,
    isPolling,
    isError,
    interruptRun,
    interruptRequested,
    switchToRun,
    respondToUserInput,
    createPR,
  } = useSeerExplorer();

  const copySessionEnabled = Boolean(
    sessionData?.status === 'completed' && !!runId && !!organization?.slug
  );

  const {copySessionToClipboard} = useCopySessionDataToClipboard({
    blocks: sessionData?.blocks || [],
    organization,
    projects,
    enabled: copySessionEnabled,
  });

  // Handle external open events (from openSeerExplorer() calls)
  const {isWaitingForSessionData} = useExternalOpen({
    isVisible,
    sendMessage,
    startNewSession,
    switchToRun,
    sessionRunId: runId ?? undefined,
    sessionBlocks: sessionData?.blocks,
    onUnminimize: useCallback(() => setIsMinimized(false), []),
  });

  // Extract repo_pr_states from session
  const repoPRStates = useMemo(
    () => sessionData?.repo_pr_states ?? {},
    [sessionData?.repo_pr_states]
  );

  // Get blocks from session data or empty array
  const blocks = useMemo(() => sessionData?.blocks || [], [sessionData]);

  // Check owner id to determine edit permission. Defensive against any useUser return shape.
  // Despite the type annotation, useUser can return null or undefined when not logged in.
  // This component is in the top-level index so we have to guard against this.
  const rawUser = useUser() as unknown;
  const ownerUserId = sessionData?.owner_user_id ?? undefined;
  const readOnly = useMemo(() => {
    const isUser = (value: unknown): value is User =>
      Boolean(
        value &&
          typeof value === 'object' &&
          'id' in value &&
          typeof value.id === 'string'
      );
    const userId = isUser(rawUser) ? rawUser.id : undefined;
    return (
      userId === undefined ||
      (ownerUserId !== undefined && ownerUserId?.toString() !== userId)
    );
  }, [rawUser, ownerUserId]);

  // Get PR widget data for menu
  const {menuItems: prWidgetItems, menuFooter: prWidgetFooter} = usePRWidgetData({
    blocks,
    repoPRStates,
    onCreatePR: createPR,
  });

  // Find the index of the last block that has todos (for special rendering)
  const latestTodoBlockIndex = useMemo(() => {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];
      if (block && Array.isArray(block.todos) && block.todos.length > 0) {
        return i;
      }
    }
    return -1;
  }, [blocks]);

  useEffect(() => {
    // Focus textarea when panel opens and reset focus
    if (isVisible) {
      setFocusedBlockIndex(-1);
      setIsMinimized(false); // Expand when opening
      userScrolledUpRef.current = false;
      allowHoverFocusChange.current = false; // Disable hover until mouse moves
      setTimeout(() => {
        // Scroll to bottom when panel opens
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isVisible]);

  // Detect clicks outside the panel to minimize it
  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsMinimized(true);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, focusedBlockIndex]);

  // Track scroll position to detect if user scrolled up
  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }

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
  }, [isVisible, focusedBlockIndex]);

  // Auto-scroll to bottom when new blocks are added, but only if user hasn't scrolled up
  useEffect(() => {
    if (!userScrolledUpRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [blocks]);

  // Update block refs array when blocks change
  useEffect(() => {
    blockRefs.current = blockRefs.current.slice(0, blocks.length);
  }, [blocks]);

  // Reset scroll state when navigating to input (which is at the bottom)
  useEffect(() => {
    if (focusedBlockIndex === -1 && scrollContainerRef.current) {
      // Small delay to let scrollIntoView complete
      setTimeout(() => {
        const container = scrollContainerRef.current;
        if (container) {
          const {scrollTop, scrollHeight, clientHeight} = container;
          const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
          if (isAtBottom) {
            userScrolledUpRef.current = false;
          }
        }
      }, 100);
    }
  }, [focusedBlockIndex]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly) {
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && !isPolling) {
        sendMessage(inputValue.trim(), undefined);
        setInputValue('');
        // Reset scroll state so we auto-scroll to show the response
        userScrolledUpRef.current = false;
        // Reset textarea height
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setIsMinimized(false);

    if (focusedBlockIndex !== -1) {
      setFocusedBlockIndex(-1);
      textareaRef.current?.focus();
    }

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  const handleBlockClick = (index: number) => {
    textareaRef.current?.blur();
    setFocusedBlockIndex(index);
    setIsMinimized(false);
  };

  const focusInput = useCallback(() => {
    hoveredBlockIndex.current = -1;
    setFocusedBlockIndex(-1);
    textareaRef.current?.focus();
    setIsMinimized(false);
  }, [setFocusedBlockIndex, textareaRef, setIsMinimized]);

  const langfuseUrl = runId ? getLangfuseUrl(runId) : undefined;

  const handleOpenLangfuse = useCallback(() => {
    // Command handler. Disabled in slash command menu for non-employees
    if (langfuseUrl) {
      window.open(langfuseUrl, '_blank');
    }
  }, [langfuseUrl]);

  const openFeedbackForm = useFeedbackForm();

  // Generic feedback handler
  const handleFeedback = useCallback(() => {
    if (openFeedbackForm) {
      openFeedbackForm({
        formTitle: 'Seer Explorer Feedback',
        messagePlaceholder: 'How can we make Seer Explorer better for you?',
        tags: {
          ['feedback.source']: 'seer_explorer',
          ['feedback.owner']: 'ml-ai',
          ...(runId === null ? {} : {['seer.run_id']: runId}),
          ...(runId === null ? {} : {['explorer_url']: getExplorerUrl(runId)}),
          ...(langfuseUrl ? {['langfuse_url']: langfuseUrl} : {}),
        },
      });
    }
  }, [openFeedbackForm, runId, langfuseUrl]);

  const {menu, isMenuOpen, menuMode, closeMenu, openSessionHistory, openPRWidget} =
    useExplorerMenu({
      clearInput: () => setInputValue(''),
      inputValue,
      focusInput,
      textAreaRef: textareaRef,
      panelSize,
      panelVisible: isVisible,
      slashCommandHandlers: {
        onMaxSize: handleMaxSize,
        onMedSize: handleMedSize,
        onNew: startNewSession,
        onFeedback: openFeedbackForm ? handleFeedback : undefined,
        onLangfuse: handleOpenLangfuse,
      },
      onChangeSession: switchToRun,
      menuAnchorRef: sessionHistoryButtonRef,
      inputAnchorRef: textareaRef,
      prWidgetAnchorRef: prWidgetButtonRef,
      prWidgetItems,
      prWidgetFooter,
    });

  const handlePanelBackgroundClick = useCallback(() => {
    setIsMinimized(false);
    closeMenu();
  }, [closeMenu]);

  // Close menu when clicking outside of it
  useEffect(() => {
    if (!isMenuOpen) {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const menuElement = document.querySelector('[data-seer-menu-panel]');

      // Don't close if clicking on the menu itself or the trigger buttons
      if (
        menuElement?.contains(target) ||
        sessionHistoryButtonRef.current?.contains(target) ||
        prWidgetButtonRef.current?.contains(target)
      ) {
        return;
      }

      // Close menu when clicking anywhere else
      closeMenu();
    };

    // Use capture phase to catch clicks before they bubble
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isMenuOpen, closeMenu]);

  const handleInputClick = useCallback(() => {
    // Click handler for the input textarea.
    focusInput();
    closeMenu();
  }, [closeMenu, focusInput]);

  const handleUnminimize = useCallback(() => {
    setIsMinimized(false);
    // Disable hover focus changes until mouse actually moves
    allowHoverFocusChange.current = false;
    // Restore focus to the previously focused block if it exists and is valid
    if (focusedBlockIndex >= 0 && focusedBlockIndex < blocks.length) {
      setTimeout(() => {
        blockRefs.current[focusedBlockIndex]?.scrollIntoView({block: 'nearest'});
      }, 100);
    } else {
      // No valid block focus, focus input
      setTimeout(() => {
        setFocusedBlockIndex(-1);
        textareaRef.current?.focus();
      }, 100);
    }
  }, [focusedBlockIndex, blocks.length]);

  const isAwaitingUserInput = sessionData?.status === 'awaiting_user_input';
  const pendingInput = sessionData?.pending_user_input;
  const isEmptyState = blocks.length === 0 && !(isAwaitingUserInput && pendingInput);

  const {
    isFileApprovalPending,
    fileApprovalIndex,
    fileApprovalTotalPatches,
    handleFileApprovalApprove,
    handleFileApprovalReject,
    // Question state
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

  // Global keyboard event listeners for when the panel is open and menu is closed.
  // Menu keyboard listeners are in the menu component.
  useEffect(() => {
    if (!isVisible || isMinimized || isMenuOpen) {
      return undefined;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const isPrintableChar = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

      if (e.key === 'Escape') {
        if (isPolling && !readOnly && !interruptRequested && !isFileApprovalPending) {
          e.preventDefault();
          interruptRun();
        } else if (readOnly || !isFileApprovalPending) {
          // Don't minimize if file approval is pending (Escape is used to reject)
          e.preventDefault();
          setIsMinimized(true);
        }
      }

      if (isPrintableChar) {
        // If a block is focused, auto-focus input when user starts typing.
        // Don't do this if file approval or question is pending (textarea isn't visible)
        if (
          !readOnly &&
          focusedBlockIndex !== -1 &&
          !isFileApprovalPending &&
          !isQuestionPending
        ) {
          e.preventDefault();
          setFocusedBlockIndex(-1);
          textareaRef.current?.focus();
          setInputValue(prev => prev + e.key);
        }
      }
    };

    // Re-enable hover focus changes when mouse actually moves
    const handleMouseMove = () => {
      allowHoverFocusChange.current = true;
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [
    isVisible,
    isMenuOpen,
    isPolling,
    readOnly,
    focusedBlockIndex,
    interruptRun,
    interruptRequested,
    isMinimized,
    isFileApprovalPending,
    isQuestionPending,
  ]);

  useBlockNavigation({
    isOpen: isVisible,
    focusedBlockIndex,
    blocks,
    blockRefs,
    textareaRef,
    setFocusedBlockIndex,
    isMinimized,
    isFileApprovalPending,
    isPolling,
    isQuestionPending,
    onDeleteFromIndex: deleteFromIndex,
    onKeyPress: (blockIndex: number, key: 'Enter' | 'ArrowUp' | 'ArrowDown') => {
      const handler = blockEnterHandlers.current.get(blockIndex);
      const handled = handler?.(key) ?? false;

      // If Enter was pressed and handled (navigation occurred), minimize the panel
      if (key === 'Enter' && handled) {
        setIsMinimized(true);
      }

      return handled;
    },
    onNavigate: () => {
      setIsMinimized(false);
      userScrolledUpRef.current = true;
    },
  });

  const handleSizeToggle = useCallback(() => {
    if (panelSize === 'max') {
      handleMedSize();
    } else {
      handleMaxSize();
    }
  }, [panelSize, handleMaxSize, handleMedSize]);

  const handleCopyLink = useCallback(async () => {
    if (!runId) {
      return;
    }

    try {
      const url = getExplorerUrl(runId);
      await navigator.clipboard.writeText(url);
      addSuccessMessage('Copied link to current chat');
    } catch {
      addErrorMessage('Failed to copy link to current chat');
    }

    trackAnalytics('seer.explorer.session_link_copied', {organization});
  }, [runId, organization]);

  const panelContent = (
    <PanelContainers
      ref={panelRef}
      isOpen={isVisible}
      isMinimized={isMinimized}
      panelSize={panelSize}
      blocks={blocks}
      isPolling={isPolling}
      onUnminimize={handleUnminimize}
    >
      <TopBar
        blocks={blocks}
        isEmptyState={isEmptyState}
        isPolling={isPolling}
        isSessionHistoryOpen={isMenuOpen && menuMode === 'session-history'}
        readOnly={readOnly}
        onCreatePR={createPR}
        onFeedbackClick={handleFeedback}
        onNewChatClick={() => {
          startNewSession();
          focusInput();
        }}
        onPRWidgetClick={openPRWidget}
        onCopySessionClick={copySessionToClipboard}
        onCopyLinkClick={handleCopyLink}
        onSessionHistoryClick={openSessionHistory}
        isCopySessionEnabled={copySessionEnabled}
        isCopyLinkEnabled={!!runId}
        onSizeToggleClick={handleSizeToggle}
        panelSize={panelSize}
        prWidgetButtonRef={prWidgetButtonRef}
        repoPRStates={repoPRStates}
        sessionHistoryButtonRef={sessionHistoryButtonRef}
      />
      {menu}
      <BlocksContainer ref={scrollContainerRef} onClick={handlePanelBackgroundClick}>
        {isEmptyState ? (
          <EmptyState
            isLoading={isWaitingForSessionData}
            isError={isError}
            runId={runId}
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
                isLast={
                  index === blocks.length - 1 && !(isAwaitingUserInput && pendingInput)
                }
                isFocused={focusedBlockIndex === index}
                isPolling={isPolling}
                readOnly={readOnly}
                onClick={() => handleBlockClick(index)}
                onMouseEnter={() => {
                  // Don't change focus while menu is open, if already on this block, or if hover is disabled
                  if (
                    isMenuOpen ||
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
                  if (hoveredBlockIndex.current === index) {
                    hoveredBlockIndex.current = -1;
                  }
                }}
                onDelete={() => {
                  deleteFromIndex(index);
                  focusInput();
                }}
                onNavigate={() => {
                  setIsMinimized(true);
                  // child handles navigation
                }}
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
        enabled={!readOnly}
        focusedBlockIndex={focusedBlockIndex}
        inputValue={inputValue}
        interruptRequested={interruptRequested}
        isMinimized={isMinimized}
        isPolling={isPolling}
        isVisible={isVisible}
        onClear={() => setInputValue('')}
        onInputChange={handleInputChange}
        onInputClick={handleInputClick}
        onInterrupt={interruptRun}
        onKeyDown={handleInputKeyDown}
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
    </PanelContainers>
  );

  if (!organization?.features.includes('seer-explorer') || organization.hideAiFeatures) {
    return null;
  }

  // Render to portal for proper z-index management
  return createPortal(panelContent, document.body);
}

export default ExplorerPanel;
