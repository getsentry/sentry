import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';

export interface SlashCommand {
  command: string;
  description: string;
  handler: () => void;
}

interface SlashCommandsProps {
  inputValue: string;
  onClose: () => void;
  onCommandSelect: (command: SlashCommand) => void;
  onMaxSize: () => void;
  onMedSize: () => void;
  onMinSize: () => void;
}

function SlashCommands({
  inputValue,
  onCommandSelect,
  onClose,
  onMaxSize,
  onMedSize,
  onMinSize,
}: SlashCommandsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const openFeedbackForm = useFeedbackForm();

  // Default slash commands
  const DEFAULT_COMMANDS = useMemo(
    (): SlashCommand[] => [
      {
        command: '/max-size',
        description: 'Expand panel to full viewport height',
        handler: onMaxSize,
      },
      {
        command: '/med-size',
        description: 'Set panel to medium size (default)',
        handler: onMedSize,
      },
      {
        command: '/min-size',
        description: 'Minimize panel to small icon',
        handler: onMinSize,
      },
      ...(openFeedbackForm
        ? [
            {
              command: '/feedback',
              description: 'Open feedback form to report issues or suggestions',
              handler: () =>
                openFeedbackForm({
                  formTitle: 'Seer Explorer Feedback',
                  messagePlaceholder: 'How can we make Seer Explorer better for you?',
                  tags: {
                    ['feedback.source']: 'seer_explorer',
                  },
                }),
            },
          ]
        : []),
    ],
    [onMaxSize, onMedSize, onMinSize, openFeedbackForm]
  );

  // Filter commands based on current input
  const filteredCommands = useMemo(() => {
    if (!inputValue.startsWith('/') || inputValue.includes(' ')) {
      return [];
    }

    const query = inputValue.toLowerCase();
    return DEFAULT_COMMANDS.filter(cmd => cmd.command.toLowerCase().startsWith(query));
  }, [inputValue, DEFAULT_COMMANDS]);

  // Show suggestions panel
  const showSuggestions = filteredCommands.length > 0;

  // Reset selected index when filtered commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  // Handle keyboard navigation with higher priority
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!showSuggestions) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex(prev => Math.min(filteredCommands.length - 1, prev + 1));
          break;
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          if (filteredCommands[selectedIndex]) {
            onCommandSelect(filteredCommands[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
        default:
          break;
      }
    },
    [showSuggestions, selectedIndex, filteredCommands, onCommandSelect, onClose]
  );

  useEffect(() => {
    if (showSuggestions) {
      // Use capture phase to intercept events before they reach other handlers
      document.addEventListener('keydown', handleKeyDown, true);
      return () => document.removeEventListener('keydown', handleKeyDown, true);
    }
    return undefined;
  }, [handleKeyDown, showSuggestions]);

  if (!showSuggestions) {
    return null;
  }

  return (
    <SuggestionsPanel>
      {filteredCommands.map((command, index) => (
        <SuggestionItem
          key={command.command}
          isSelected={index === selectedIndex}
          onClick={() => onCommandSelect(command)}
        >
          <CommandName>{command.command}</CommandName>
          <CommandDescription>{command.description}</CommandDescription>
        </SuggestionItem>
      ))}
    </SuggestionsPanel>
  );
}

export default SlashCommands;

const SuggestionsPanel = styled('div')`
  position: absolute;
  bottom: 100%;
  left: ${space(2)};
  width: 300px;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-bottom: none;
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
`;

const SuggestionItem = styled('div')<{isSelected: boolean}>`
  padding: ${space(1.5)} ${space(2)};
  cursor: pointer;
  background: ${p => (p.isSelected ? p.theme.hover : 'transparent')};
  border-bottom: 1px solid ${p => p.theme.border};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${p => p.theme.hover};
  }
`;

const CommandName = styled('div')`
  font-weight: 600;
  color: ${p => p.theme.pink400};
  font-size: ${p => p.theme.fontSize.sm};
`;

const CommandDescription = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.xs};
  margin-top: 2px;
`;
