import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

import {useBlockNavigation} from './hooks/useBlockNavigation';
import {useBlockSubmission} from './hooks/useBlockSubmission';
import {usePanelSizing} from './hooks/usePanelSizing';
import BlockComponent from './blockComponents';
import EmptyState from './emptyState';
import InputSection from './inputSection';
import PanelContainers, {BlocksContainer} from './panelContainers';
import type {SlashCommand} from './slashCommands';
import type {Block, ExplorerPanelProps} from './types';

function ExplorerPanel({isVisible = false}: ExplorerPanelProps) {
  const [isOpen, setIsOpen] = useState(isVisible);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [focusedBlockIndex, setFocusedBlockIndex] = useState(-1); // -1 means input is focused
  const [showSlashCommands, setShowSlashCommands] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Array<HTMLDivElement | null>>([]);

  const {panelSize, handleMaxSize, handleMedSize, handleMinSize, handleMinPanelClick} =
    usePanelSizing();
  const {handleSubmit} = useBlockSubmission({setBlocks, setInputValue, textareaRef});

  useBlockNavigation({
    isOpen,
    focusedBlockIndex,
    blocks,
    blockRefs,
    textareaRef,
    setFocusedBlockIndex,
  });

  // Sync with prop changes
  useEffect(() => {
    setIsOpen(isVisible);
    // Focus textarea when panel opens and reset focus
    if (isVisible) {
      setFocusedBlockIndex(-1);
      setTimeout(() => {
        // Scroll to bottom when panel opens
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
        textareaRef.current?.focus();
      }, 100);
    }
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
      handleSubmit(inputValue);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);

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
  };

  const handleInputClick = () => {
    setFocusedBlockIndex(-1);
    textareaRef.current?.focus();
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
      isOpen={isOpen}
      panelSize={panelSize}
      onMinPanelClick={handleMinPanelClick}
    >
      <BlocksContainer ref={scrollContainerRef}>
        {blocks.length === 0 ? (
          <EmptyState />
        ) : (
          blocks.map((block, index) => (
            <BlockComponent
              key={block.id}
              ref={el => {
                blockRefs.current[index] = el;
              }}
              block={block}
              isLast={index === blocks.length - 1}
              isFocused={focusedBlockIndex === index}
              onClick={() => handleBlockClick(index)}
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
        onMinSize={handleMinSize}
      />
    </PanelContainers>
  );

  // Render to portal for proper z-index management
  return createPortal(panelContent, document.body);
}

export default ExplorerPanel;
