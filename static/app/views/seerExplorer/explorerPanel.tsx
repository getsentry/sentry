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
  const [showSlashCommands, setShowSlashCommands] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false); // state for slide-down
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Array<HTMLDivElement | null>>([]);
  const blockEnterHandlers = useRef<
    Map<number, (key: 'Enter' | 'ArrowUp' | 'ArrowDown') => boolean>
  >(new Map());
  const panelRef = useRef<HTMLDivElement>(null);

  // Custom hooks
  const {panelSize, handleMaxSize, handleMedSize} = usePanelSizing();
  const {sessionData, sendMessage, deleteFromIndex, startNewSession, isPolling} =
    useSeerExplorer();

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
    },
  });

  useEffect(() => {
    // Focus textarea when panel opens and reset focus
    if (isVisible) {
      setFocusedBlockIndex(-1);
      setIsMinimized(false); // Expand when opening
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

  // Auto-scroll to bottom when new blocks are added
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [blocks]);

  // Update block refs array when blocks change
  useEffect(() => {
    blockRefs.current = blockRefs.current.slice(0, blocks.length);
  }, [blocks]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && !isPolling) {
        sendMessage(inputValue.trim());
        setInputValue('');
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

    // Check if we should show slash commands
    const shouldShow = value.startsWith('/') && !value.includes(' ') && value.length > 1;
    setShowSlashCommands(shouldShow);

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

    // Clear input and hide slash commands
    setInputValue('');
    setShowSlashCommands(false);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleSlashCommandsClose = () => {
    setShowSlashCommands(false);
  };

  const panelContent = (
    <PanelContainers
      ref={panelRef}
      isOpen={isVisible}
      isMinimized={isMinimized}
      panelSize={panelSize}
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
              onClick={() => handleBlockClick(index)}
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
        showSlashCommands={showSlashCommands}
        onInputChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onInputClick={handleInputClick}
        onCommandSelect={handleCommandSelect}
        onSlashCommandsClose={handleSlashCommandsClose}
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
