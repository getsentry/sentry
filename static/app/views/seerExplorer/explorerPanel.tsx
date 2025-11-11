import {useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

import useOrganization from 'sentry/utils/useOrganization';

import {useBlockNavigation} from './hooks/useBlockNavigation';
import {usePanelSizing} from './hooks/usePanelSizing';
import {useSeerExplorer} from './hooks/useSeerExplorer';
import BlockComponent from './blockComponents';
import EmptyState from './emptyState';
import InputSection from './inputSection';
import PanelContainers, {BlocksContainer} from './panelContainers';
import type {SlashCommand} from './slashCommands';
import type {Block, ExplorerPanelProps} from './types';

function ExplorerPanel({isVisible = false}: ExplorerPanelProps) {
  const organization = useOrganization({allowNull: true});

  const [inputValue, setInputValue] = useState('');
  const [focusedBlockIndex, setFocusedBlockIndex] = useState(-1); // -1 means input is focused
  const [isSlashCommandsVisible, setIsSlashCommandsVisible] = useState(false);
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
  } = useSeerExplorer();

  // Get blocks from session data or empty array
  const blocks = useMemo(() => sessionData?.blocks || [], [sessionData]);

  useBlockNavigation({
    isOpen: isVisible,
    focusedBlockIndex,
    blocks,
    blockRefs,
    textareaRef,
    setFocusedBlockIndex,
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

  useEffect(() => {
    // Focus textarea when panel opens and reset focus
    if (isVisible) {
      setFocusedBlockIndex(-1);
      setIsMinimized(false); // Expand when opening
      userScrolledUpRef.current = false;
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
  }, [isVisible]);

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

  // Auto-focus input when user starts typing while a block is focused
  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (focusedBlockIndex !== -1) {
        const isPrintableChar =
          e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

        if (isPrintableChar) {
          e.preventDefault();
          setFocusedBlockIndex(-1);
          textareaRef.current?.focus();
          setInputValue(prev => prev + e.key);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible, focusedBlockIndex]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && isPolling && !interruptRequested) {
      e.preventDefault();
      interruptRun();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && !isPolling) {
        sendMessage(inputValue.trim());
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
    setFocusedBlockIndex(index);
    setIsMinimized(false);
  };

  const handleInputClick = () => {
    hoveredBlockIndex.current = -1;
    setFocusedBlockIndex(-1);
    textareaRef.current?.focus();
    setIsMinimized(false);
  };

  const handlePanelBackgroundClick = () => {
    setIsMinimized(false);
  };

  const handleCommandSelect = (command: SlashCommand) => {
    // Execute the command
    command.handler();

    // Clear input
    setInputValue('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const panelContent = (
    <PanelContainers
      ref={panelRef}
      isOpen={isVisible}
      isMinimized={isMinimized}
      panelSize={panelSize}
      onUnminimize={() => setIsMinimized(false)}
    >
      <BlocksContainer ref={scrollContainerRef} onClick={handlePanelBackgroundClick}>
        {blocks.length === 0 ? (
          <EmptyState />
        ) : (
          blocks.map((block: Block, index: number) => (
            <BlockComponent
              key={block.id}
              ref={el => {
                blockRefs.current[index] = el;
              }}
              block={block}
              blockIndex={index}
              isLast={index === blocks.length - 1}
              isFocused={focusedBlockIndex === index}
              isPolling={isPolling}
              onClick={() => handleBlockClick(index)}
              onMouseEnter={() => {
                // Don't change focus while slash commands menu is open or if already on this block
                if (isSlashCommandsVisible || hoveredBlockIndex.current === index) {
                  return;
                }

                hoveredBlockIndex.current = index;
                setFocusedBlockIndex(index);
                if (document.activeElement === textareaRef.current) {
                  textareaRef.current?.blur();
                }
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
          ))
        )}
      </BlocksContainer>
      <InputSection
        ref={textareaRef}
        inputValue={inputValue}
        focusedBlockIndex={focusedBlockIndex}
        isPolling={isPolling}
        interruptRequested={interruptRequested}
        onInputChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onInputClick={handleInputClick}
        onCommandSelect={handleCommandSelect}
        onSlashCommandsVisibilityChange={setIsSlashCommandsVisible}
        onMaxSize={handleMaxSize}
        onMedSize={handleMedSize}
        onClear={startNewSession}
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
