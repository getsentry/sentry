import {Activity, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {space} from 'sentry/styles/space';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useExplorerSessions} from 'sentry/views/seerExplorer/hooks/useExplorerSessions';

import {useExplorerPanelContext} from './explorerPanelContext';

export interface MenuItemProps {
  description: string;
  handler: () => void;
  key: string;
  title: string;
}

export function ExplorerMenu() {
  const {menuMode, setMenuMode, inputValue, clearInput, textAreaRef} =
    useExplorerPanelContext();

  const allSlashCommands = useSlashCommands();

  const filteredSlashCommands = useMemo(() => {
    // Filter commands based on current input
    if (!inputValue.startsWith('/') || inputValue.includes(' ')) {
      return [];
    }
    const query = inputValue.toLowerCase();
    return allSlashCommands.filter(cmd => cmd.title.toLowerCase().startsWith(query));
  }, [allSlashCommands, inputValue]);

  const {sessionItems, refetchSessions, isSessionsPending, isSessionsError} =
    useSessions();

  // Menu items and select handlers change based on the mode.
  const menuItems = useMemo(() => {
    switch (menuMode) {
      case 'slash-commands-keyboard':
        return filteredSlashCommands;
      case 'slash-commands-manual':
        return allSlashCommands;
      case 'session-history':
        return sessionItems;
      default:
        return [];
    }
  }, [menuMode, allSlashCommands, filteredSlashCommands, sessionItems]);

  const onSelect = useCallback(
    (item: MenuItemProps) => {
      // Execute custom handler.
      item.handler();

      if (menuMode === 'slash-commands-keyboard') {
        // Clear input and reset textarea height.  // TODO: is this needed for all selects?
        clearInput();
        if (textAreaRef.current) {
          textAreaRef.current.style.height = 'auto';
        }
      }

      if (item.key === '/resume') {
        // Handle /resume command here since it changes the menu mode.
        setMenuMode('session-history');
        refetchSessions();
      } else {
        // Close the menu.
        setMenuMode('hidden');
      }
    },
    // clearInput and textAreaRef are both expected to be stable.
    [menuMode, clearInput, textAreaRef, setMenuMode, refetchSessions]
  );

  // Toggle between slash-commands-keyboard and hidden modes based on filteredSlashCommands.
  useEffect(() => {
    if (menuMode === 'slash-commands-keyboard' && filteredSlashCommands.length === 0) {
      setMenuMode('hidden');
    } else if (menuMode === 'hidden' && filteredSlashCommands.length > 0) {
      setMenuMode('slash-commands-keyboard');
    }
  }, [menuMode, setMenuMode, filteredSlashCommands]);

  const isVisible = menuMode !== 'hidden';

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selected index when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [menuItems]);

  // Handle keyboard navigation with higher priority
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isVisible) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex(prev => Math.min(menuItems.length - 1, prev + 1));
          break;
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          if (menuItems[selectedIndex]) {
            onSelect(menuItems[selectedIndex]);
          }
          break;
        default:
          break;
      }
    },
    [isVisible, selectedIndex, menuItems, onSelect]
  );

  useEffect(() => {
    if (isVisible) {
      // Use capture phase to intercept events before they reach other handlers
      document.addEventListener('keydown', handleKeyDown, true);
      return () => document.removeEventListener('keydown', handleKeyDown, true);
    }
    return undefined;
  }, [handleKeyDown, isVisible]);

  return (
    <Activity mode={isVisible ? 'visible' : 'hidden'}>
      <MenuPanel>
        {menuItems.map((item, index) => (
          <MenuItem
            key={item.key}
            isSelected={index === selectedIndex}
            onClick={() => onSelect(item)}
          >
            <ItemName>{item.title}</ItemName>
            <ItemDescription>{item.description}</ItemDescription>
          </MenuItem>
        ))}
        {menuMode === 'session-history' && menuItems.length === 0 && (
          <MenuItem key="empty-state" isSelected={false}>
            <ItemName>
              {isSessionsPending
                ? 'Loading sessions...'
                : isSessionsError
                  ? 'Error loading sessions.'
                  : 'No session history found.'}
            </ItemName>
          </MenuItem>
        )}
      </MenuPanel>
    </Activity>
  );
}

function useSlashCommands(): MenuItemProps[] {
  const {onMaxSize, onMedSize, onNew} = useExplorerPanelContext();

  const openFeedbackForm = useFeedbackForm();

  return useMemo(
    (): MenuItemProps[] => [
      {
        title: '/new',
        key: '/new',
        description: 'Start a new session',
        handler: onNew,
      },
      {
        title: '/resume',
        key: '/resume',
        description: 'View your session history to resume past sessions',
        handler: () => {}, // Handled by parent onSelect callback.
      },
      {
        title: '/max-size',
        key: '/max-size',
        description: 'Expand panel to full viewport height',
        handler: onMaxSize,
      },
      {
        title: '/med-size',
        key: '/med-size',
        description: 'Set panel to medium size (default)',
        handler: onMedSize,
      },
      ...(openFeedbackForm
        ? [
            {
              title: '/feedback',
              key: '/feedback',
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
}

function useSessions() {
  const {data, isPending, isError, refetch} = useExplorerSessions({limit: 20});
  const {onResume} = useExplorerPanelContext();

  const formatDate = (date: string) => {
    return moment(date).format('MM/DD/YYYY HH:mm');
  };

  const sessionItems = useMemo(() => {
    if (isPending || isError) {
      return [];
    }

    return data?.data.map(session => ({
      title: session.title,
      key: session.run_id.toString(),
      description: `Last updated at ${formatDate(session.last_triggered_at)}`,
      handler: () => {
        onResume(session.run_id);
      },
    }));
  }, [data, isPending, isError, onResume]);

  return {
    sessionItems,
    isSessionsPending: isPending,
    isSessionsError: isError,
    isError,
    refetchSessions: refetch,
  };
}

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

const ItemName = styled('div')`
  font-weight: 600;
  color: ${p => p.theme.purple400};
  font-size: ${p => p.theme.fontSize.sm};
`;

const ItemDescription = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.xs};
  margin-top: 2px;
`;
