import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

import useOrganization from 'sentry/utils/useOrganization';
import BlockComponent from 'sentry/views/seerExplorer/blockComponents';
import EmptyState from 'sentry/views/seerExplorer/emptyState';
import {useExplorerMenu} from 'sentry/views/seerExplorer/explorerMenu';
import FileChangeApprovalBlock from 'sentry/views/seerExplorer/fileChangeApprovalBlock';
import {useBlockNavigation} from 'sentry/views/seerExplorer/hooks/useBlockNavigation';
import {usePanelSizing} from 'sentry/views/seerExplorer/hooks/usePanelSizing';
import {usePendingUserInput} from 'sentry/views/seerExplorer/hooks/usePendingUserInput';
import {useSeerExplorer} from 'sentry/views/seerExplorer/hooks/useSeerExplorer';
import InputSection from 'sentry/views/seerExplorer/inputSection';
import PanelContainers, {
  BlocksContainer,
} from 'sentry/views/seerExplorer/panelContainers';
import type {Block, ExplorerPanelProps} from 'sentry/views/seerExplorer/types';

function ExplorerPanel({isVisible = false}: ExplorerPanelProps) {
  const organization = useOrganization({allowNull: true});

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

  // Custom hooks
  const {panelSize, handleMaxSize, handleMedSize} = usePanelSizing();
  const {
    sessionData,
    sendMessage,
    deleteFromIndex,
    startNewSession,
    isPolling,
    interruptRun,
    interruptRequested,
    setRunId,
    respondToUserInput,
  } = useSeerExplorer();

  // Get blocks from session data or empty array
  const blocks = useMemo(() => sessionData?.blocks || [], [sessionData]);

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

  const {menu, isMenuOpen, closeMenu, onMenuButtonClick} = useExplorerMenu({
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
    },
    onChangeSession: setRunId,
  });

  const handlePanelBackgroundClick = useCallback(() => {
    setIsMinimized(false);
    closeMenu();
  }, [closeMenu]);

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

  const {
    isFileApprovalPending,
    fileApprovalIndex,
    fileApprovalTotalPatches,
    handleFileApprovalApprove,
    handleFileApprovalReject,
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

      if (e.key === 'Escape' && isPolling && !interruptRequested) {
        e.preventDefault();
        interruptRun();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsMinimized(true);
      } else if (isPrintableChar) {
        // Don't auto-type if file approval is pending (textarea isn't visible)
        if (focusedBlockIndex !== -1 && !isFileApprovalPending) {
          // If a block is focused, auto-focus input when user starts typing.
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
    focusedBlockIndex,
    interruptRun,
    interruptRequested,
    isMinimized,
    isFileApprovalPending,
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

  const panelContent = (
    <PanelContainers
      ref={panelRef}
      isOpen={isVisible}
      isMinimized={isMinimized}
      panelSize={panelSize}
      onUnminimize={handleUnminimize}
    >
      <BlocksContainer ref={scrollContainerRef} onClick={handlePanelBackgroundClick}>
        {blocks.length === 0 && !(isAwaitingUserInput && pendingInput) ? (
          <EmptyState />
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
                isAwaitingFileApproval={isFileApprovalPending}
                isLast={
                  index === blocks.length - 1 && !(isAwaitingUserInput && pendingInput)
                }
                isFocused={focusedBlockIndex === index}
                isPolling={isPolling}
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
                onDelete={() => deleteFromIndex(index)}
                onNavigate={() => setIsMinimized(true)}
                onRegisterEnterHandler={handler => {
                  blockEnterHandlers.current.set(index, handler);
                }}
              />
            ))}
            {isFileApprovalPending && fileApprovalIndex < fileApprovalTotalPatches && (
              <FileChangeApprovalBlock
                currentIndex={fileApprovalIndex}
                isLast
                pendingInput={pendingInput!}
              />
            )}
          </Fragment>
        )}
      </BlocksContainer>
      <InputSection
        menu={menu}
        onMenuButtonClick={onMenuButtonClick}
        focusedBlockIndex={focusedBlockIndex}
        inputValue={inputValue}
        interruptRequested={interruptRequested}
        isMinimized={isMinimized}
        isPolling={isPolling}
        isVisible={isVisible}
        onClear={() => setInputValue('')}
        onInputChange={handleInputChange}
        onInputClick={handleInputClick}
        textAreaRef={textareaRef}
        onKeyDown={handleInputKeyDown}
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
