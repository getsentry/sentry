import React, {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';

import SlashCommands, {type SlashCommand} from './slashCommands';
import type {Block} from './types';
import {getToolsStringFromBlock} from './utils';

interface MinimizedStripProps {
  blocks: Block[];
  isPolling: boolean;
  onClear: () => void;
  onMaxSize: () => void;
  onMedSize: () => void;
  onMinSize: () => void;
  onSubmit: (message: string) => void;
}

function MinimizedStrip({
  blocks,
  onSubmit,
  isPolling,
  onMaxSize,
  onMedSize,
  onMinSize,
  onClear,
}: MinimizedStripProps) {
  const [isInputMode, setIsInputMode] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [shouldAnimate, setShouldAnimate] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const messageTextRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);

  // Find the last assistant message
  const lastAssistantMessage = blocks
    .slice()
    .reverse()
    .find(
      block => block.message.role === 'assistant' || block.message.role === 'tool_use'
    );

  useEffect(() => {
    if (isInputMode && inputRef.current) {
      inputRef.current.focus();
      // Position cursor at the end if there's content (e.g., from "/" shortcut)
      if (inputValue) {
        inputRef.current.setSelectionRange(inputValue.length, inputValue.length);
      }
    }
  }, [isInputMode, inputValue]);

  // Check if text overflows and should animate
  useEffect(() => {
    const checkOverflow = () => {
      if (!isInputMode && messageTextRef.current && messageContainerRef.current) {
        const textWidth = messageTextRef.current.scrollWidth;
        const containerWidth = messageContainerRef.current.clientWidth;
        const needsAnimation = textWidth > containerWidth;
        setShouldAnimate(needsAnimation);

        // Set CSS custom property and calculate duration based on scroll distance
        if (needsAnimation) {
          const scrollDistance = textWidth - containerWidth + 20; // 20px buffer
          messageTextRef.current.style.setProperty(
            '--scroll-distance',
            `-${scrollDistance}px`
          );

          // Calculate duration: 2s pause + scroll + 2s pause + quick return
          const scrollingSpeed = 60; // pixels per second for comfortable reading
          const scrollTime = scrollDistance / scrollingSpeed; // time to scroll to end
          const pauseTime = 2; // fixed 2 second pauses
          const returnTime = 0.3; // very quick 0.3 second return

          const totalDuration = pauseTime + scrollTime + pauseTime + returnTime;
          const finalDuration = Math.max(5, totalDuration); // minimum 5 seconds

          // Set CSS custom properties
          messageTextRef.current.style.setProperty(
            '--animation-duration',
            `${finalDuration}s`
          );
        }
      }
    };

    checkOverflow();

    // Recheck on window resize
    const handleResize = () => {
      setTimeout(checkOverflow, 100); // Small delay to ensure layout is updated
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isInputMode, blocks, lastAssistantMessage]);

  // Force animation restart after shouldAnimate is calculated
  useEffect(() => {
    if (shouldAnimate && messageTextRef.current && !isInputMode) {
      // Reset animation immediately to stop any current animation
      const element = messageTextRef.current;
      element.style.animation = 'none';
      void element.offsetHeight; // Force reflow

      // Add a longer delay to allow for the initial pause when new content appears
      setTimeout(() => {
        if (messageTextRef.current) {
          messageTextRef.current.style.animation = ''; // Restart animation from 0%
        }
      }, 2000); // 2 second delay to match the initial pause duration
    }
  }, [shouldAnimate, lastAssistantMessage?.message.content, isInputMode]);

  // Handle global keys to switch to input mode and start typing
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!isInputMode) {
        // Don't interfere with system shortcuts
        if (e.ctrlKey || e.altKey || e.metaKey) return;

        if (e.key === 'Tab') {
          e.preventDefault();
          setIsInputMode(true);
        } else if (e.key === '/' || /^[a-zA-Z]$/.test(e.key)) {
          e.preventDefault();
          setInputValue(e.key);
          setIsInputMode(true);
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isInputMode]);

  const handleStripClick = () => {
    if (!isInputMode) {
      setIsInputMode(true);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      // Tab refocuses the input (already focused in this case)
      inputRef.current?.focus();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && !isPolling) {
        onSubmit(inputValue.trim());
        setInputValue('');
        setIsInputMode(false);
      }
    } else if (e.key === 'Escape') {
      setIsInputMode(false);
      setInputValue('');
    }
  };

  const handleInputBlur = () => {
    setIsInputMode(false);
    setInputValue('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
  };

  const handleCommandSelect = (command: SlashCommand) => {
    // Execute the command
    command.handler();

    // Clear input and hide slash commands
    setInputValue('');
    setIsInputMode(false);
  };

  const handleSlashCommandsClose = () => {
    // SlashCommands component handles its own visibility
  };

  // Get display text - clean but don't truncate for ticker
  const getDisplayText = () => {
    if (!lastAssistantMessage) {
      return 'Ask Seer anything about your app...';
    }

    const content =
      lastAssistantMessage.message.content ||
      getToolsStringFromBlock(lastAssistantMessage).join(', ');
    // Remove markdown and limit to one line
    const cleanContent = content
      .replace(/[#*`\n]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleanContent;
  };

  return (
    <StripContainer
      initial={{opacity: 0, y: 20}}
      animate={{opacity: 1, y: 0}}
      exit={{opacity: 0, y: 20}}
      transition={{duration: 0.2, ease: 'easeInOut'}}
      onClick={handleStripClick}
      isInputMode={isInputMode}
      data-seer-explorer-root=""
    >
      {isInputMode ? (
        <InputRow>
          <StripSlashCommandsWrapper>
            <SlashCommands
              inputValue={inputValue}
              onCommandSelect={handleCommandSelect}
              onClose={handleSlashCommandsClose}
              onMaxSize={onMaxSize}
              onMedSize={onMedSize}
              onMinSize={onMinSize}
              onClear={onClear}
            />
          </StripSlashCommandsWrapper>
          <ChevronIcon direction="right" size="sm" />
          <StripInput
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onBlur={handleInputBlur}
            placeholder="Type your message and press Enter ↵"
          />
        </InputRow>
      ) : (
        <MessageRow>
          <ResponseDot isLoading={isPolling} />
          <MessageContainer ref={messageContainerRef}>
            <MessageText ref={messageTextRef} shouldAnimate={shouldAnimate}>
              {getDisplayText()}
            </MessageText>
          </MessageContainer>
        </MessageRow>
      )}
    </StripContainer>
  );
}

export default MinimizedStrip;

const StripContainer = styled(motion.div)<{isInputMode: boolean}>`
  position: fixed;
  bottom: ${space(2)};
  left: 25%;
  width: calc(100vw - ${space(4)});
  max-width: 800px;
  height: 48px;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  display: flex;
  align-items: center;
  z-index: 10000;
  cursor: ${p => (p.isInputMode ? 'default' : 'pointer')};
  overflow: ${p => (p.isInputMode ? 'visible' : 'hidden')};
  transform: translateX(-50%);

  &:hover {
    background: ${p =>
      p.isInputMode ? p.theme.background : p.theme.backgroundSecondary};
  }
`;

const StripSlashCommandsWrapper = styled('div')`
  /* Override the z-index of SlashCommands panel to appear above the strip */
  & > div {
    z-index: 10001 !important;
  }
`;

const InputRow = styled('div')`
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  position: relative;
`;

const MessageRow = styled('div')`
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  position: relative;
`;

const ChevronIcon = styled(IconChevron)`
  color: ${p => p.theme.subText};
  margin-left: ${space(2)};
  margin-right: ${space(1)};
  flex-shrink: 0;
`;

const ResponseDot = styled('div')<{isLoading?: boolean}>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: ${space(2)};
  margin-right: ${space(1.5)};
  flex-shrink: 0;
  background: ${p => (p.isLoading ? p.theme.pink400 : p.theme.purple400)};

  ${p =>
    p.isLoading &&
    `
    animation: blink 1s infinite;

    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0.3; }
    }
  `}
`;

const MessageContainer = styled('div')`
  flex: 1;
  overflow: hidden;
  position: relative;
  margin-right: ${p => p.theme.space.md};
`;

const MessageText = styled('div')<{shouldAnimate: boolean}>`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSize.md};
  white-space: nowrap;
  display: inline-block;

  ${p =>
    p.shouldAnimate &&
    `
    animation: ticker var(--animation-duration, 10s) ease-in-out infinite;
    --scroll-distance: -50%;
    --animation-duration: 10s;

    @keyframes ticker {
      /* Start pause */
      0%, 30% {
        transform: translateX(0);
      }
      /* Scroll to end */
      30%, 85% {
        transform: translateX(var(--scroll-distance, -50%));
      }
      /* End pause */
      85%, 90% {
        transform: translateX(var(--scroll-distance, -50%));
      }
      /* Quick return to start */
      90%, 100% {
        transform: translateX(0);
      }
    }
  `}

  /* Pause animation on hover */
  ${MessageContainer}:hover & {
    animation-play-state: paused;
  }
`;

const StripInput = styled('input')`
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  padding: 0 ${space(2)} 0 0;
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSize.md};
  height: 100%;

  &::placeholder {
    color: ${p => p.theme.subText};
  }

  &:focus {
    outline: none;
  }
`;
