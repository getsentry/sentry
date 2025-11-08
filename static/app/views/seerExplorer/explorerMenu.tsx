import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';

import {useExplorerPanelContext} from './explorerPanelContext';

export interface MenuAction {
  description: string;
  handler: () => void;
  title: string;
}

function ExplorerMenu() {
  const {
    inputValue,
    onCommandSelect,
    onMaxSize,
    onMedSize,
    onNew,
    onMenuVisibilityChange,
  } = useExplorerPanelContext();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const openFeedbackForm = useFeedbackForm();

  // Default slash commands
  const DEFAULT_SLASH_COMMANDS = useMemo(
    (): MenuAction[] => [
      {
        title: '/new',
        description: 'Start a new session',
        handler: onNew,
      },
      {
        title: '/max-size',
        description: 'Expand panel to full viewport height',
        handler: onMaxSize,
      },
      {
        title: '/med-size',
        description: 'Set panel to medium size (default)',
        handler: onMedSize,
      },
      ...(openFeedbackForm
        ? [
            {
              title: '/feedback',
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
    [onNew, onMaxSize, onMedSize, openFeedbackForm]
  );

  // Filter commands based on current input
  const filteredCommands = useMemo(() => {
    if (!inputValue.startsWith('/') || inputValue.includes(' ')) {
      return [];
    }
    const query = inputValue.toLowerCase();
    return DEFAULT_SLASH_COMMANDS.filter(cmd =>
      cmd.title.toLowerCase().startsWith(query)
    );
  }, [inputValue, DEFAULT_SLASH_COMMANDS]);

  // Show suggestions panel
  const showSuggestions = filteredCommands.length > 0;

  // Reset selected index when filtered commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  // Notify parent when visibility changes
  useEffect(() => {
    onMenuVisibilityChange?.(showSuggestions);
  }, [showSuggestions, onMenuVisibilityChange]);

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
        default:
          break;
      }
    },
    [showSuggestions, selectedIndex, filteredCommands, onCommandSelect]
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
    <MenuPanel>
      {filteredCommands.map((command, index) => (
        <MenuItem
          key={command.title}
          isSelected={index === selectedIndex}
          onClick={() => onCommandSelect(command)}
        >
          <ActionName>{command.title}</ActionName>
          <ActionDescription>{command.description}</ActionDescription>
        </MenuItem>
      ))}
    </MenuPanel>
  );
}

export default ExplorerMenu;

const MenuPanel = styled('div')`
  position: absolute;
  bottom: 100%;
  left: ${space(2)};
  width: 300px;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-bottom: none;
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  max-height: 500px;
  overflow-y: auto;
  z-index: 10;
`;

const MenuItem = styled('div')<{isSelected: boolean}>`
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

const ActionName = styled('div')`
  font-weight: 600;
  color: ${p => p.theme.purple400};
  font-size: ${p => p.theme.fontSize.sm};
`;

const ActionDescription = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.xs};
  margin-top: 2px;
`;
