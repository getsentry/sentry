import {Activity, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import TimeSince from 'sentry/components/timeSince';
import {space} from 'sentry/styles/space';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useExplorerSessions} from 'sentry/views/seerExplorer/hooks/useExplorerSessions';

type MenuMode =
  | 'slash-commands-keyboard'
  | 'slash-commands-manual'
  | 'session-history'
  | 'hidden';

interface ExplorerMenuProps {
  clearInput: () => void;
  focusInput: () => void;
  inputValue: string;
  onChangeSession: (runId: number) => void;
  panelSize: 'max' | 'med';
  panelVisible: boolean;
  slashCommandHandlers: {
    onMaxSize: () => void;
    onMedSize: () => void;
    onNew: () => void;
  };
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
}

interface MenuItemProps {
  description: string | React.ReactNode;
  handler: () => void;
  key: string;
  title: string;
}

export function useExplorerMenu({
  clearInput,
  inputValue,
  focusInput,
  textAreaRef,
  panelSize,
  panelVisible,
  slashCommandHandlers,
  onChangeSession,
}: ExplorerMenuProps) {
  const [menuMode, setMenuMode] = useState<MenuMode>('hidden');

  const allSlashCommands = useSlashCommands(slashCommandHandlers);

  const filteredSlashCommands = useMemo(() => {
    // Filter commands based on current input
    if (!inputValue.startsWith('/') || inputValue.includes(' ')) {
      return [];
    }
    const query = inputValue.toLowerCase();
    return allSlashCommands.filter(cmd => cmd.title.toLowerCase().startsWith(query));
  }, [allSlashCommands, inputValue]);

  const {sessionItems, refetchSessions, isSessionsPending, isSessionsError} = useSessions(
    {onChangeSession, enabled: panelVisible}
  );

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

  const close = useCallback(() => {
    setMenuMode('hidden');
    if (menuMode === 'slash-commands-keyboard') {
      // Clear input and reset textarea height.
      clearInput();
      if (textAreaRef.current) {
        textAreaRef.current.style.height = 'auto';
      }
    }
  }, [menuMode, setMenuMode, clearInput, textAreaRef]);

  const closeAndFocusInput = useCallback(() => {
    close();
    focusInput();
  }, [close, focusInput]);

  const onSelect = useCallback(
    (item: MenuItemProps) => {
      // Execute custom handler.
      item.handler();

      if (menuMode === 'slash-commands-keyboard') {
        // Clear input and reset textarea height.
        clearInput();
        if (textAreaRef.current) {
          textAreaRef.current.style.height = 'auto';
        }
      }

      if (item.key === '/resume') {
        // Handle /resume command here - avoid changing menu state from item handlers.
        setMenuMode('session-history');
        refetchSessions();
      } else {
        // Default to closing the menu after an item is selected and handled.
        closeAndFocusInput();
      }
    },
    // clearInput and textAreaRef are both expected to be stable.
    [menuMode, clearInput, textAreaRef, setMenuMode, refetchSessions, closeAndFocusInput]
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
  const menuItemRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Reset selected index when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [menuItems]);

  // Scroll selected item into view when selection changes
  useEffect(() => {
    if (isVisible && menuItemRefs.current[selectedIndex]) {
      menuItemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex, isVisible]);

  // Handle keyboard navigation with higher priority
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isVisible) return;

      const isPrintableChar = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => Math.min(menuItems.length - 1, prev + 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (menuItems[selectedIndex]) {
          onSelect(menuItems[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeAndFocusInput();
        if (menuMode === 'slash-commands-keyboard') {
          clearInput();
        }
      } else if (isPrintableChar && menuMode !== 'slash-commands-keyboard') {
        closeAndFocusInput();
      }
    },
    [
      isVisible,
      selectedIndex,
      menuItems,
      onSelect,
      clearInput,
      menuMode,
      closeAndFocusInput,
    ]
  );

  useEffect(() => {
    if (isVisible) {
      // Use capture phase to intercept events before they reach other handlers
      document.addEventListener('keydown', handleKeyDown, true);
      return () => document.removeEventListener('keydown', handleKeyDown, true);
    }
    return undefined;
  }, [handleKeyDown, isVisible]);

  const menu = (
    <Activity mode={isVisible ? 'visible' : 'hidden'}>
      <MenuPanel panelSize={panelSize}>
        {menuItems.map((item, index) => (
          <MenuItem
            key={item.key}
            ref={el => {
              menuItemRefs.current[index] = el;
            }}
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

  // Handler for the button entrypoint.
  const onMenuButtonClick = useCallback(() => {
    if (menuMode === 'hidden') {
      setMenuMode('slash-commands-manual');
    } else {
      close();
    }
  }, [menuMode, setMenuMode, close]);

  return {
    menu,
    menuMode,
    isMenuOpen: menuMode !== 'hidden',
    closeMenu: close,
    onMenuButtonClick,
  };
}

function useSlashCommands({
  onMaxSize,
  onMedSize,
  onNew,
}: {
  onMaxSize: () => void;
  onMedSize: () => void;
  onNew: () => void;
}): MenuItemProps[] {
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

function useSessions({
  onChangeSession,
  enabled,
}: {
  onChangeSession: (runId: number) => void;
  enabled?: boolean;
}) {
  const {data, isPending, isError, refetch} = useExplorerSessions({limit: 20, enabled});

  const sessionItems = useMemo(() => {
    if (isPending || isError) {
      return [];
    }

    return data.data.map(session => ({
      title: session.title,
      key: session.run_id.toString(),
      description: (
        <TimeSince
          tooltipPrefix="Last updated"
          date={moment.utc(session.last_triggered_at).toDate()}
          suffix="ago"
        />
      ),
      handler: () => {
        onChangeSession(session.run_id);
      },
    }));
  }, [data, isPending, isError, onChangeSession]);

  return {
    sessionItems,
    isSessionsPending: isPending,
    isSessionsError: isError,
    isError,
    refetchSessions: refetch,
  };
}

const MenuPanel = styled('div')<{
  panelSize: 'max' | 'med';
}>`
  position: absolute;
  bottom: 100%;
  left: ${space(2)};
  width: 300px;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  max-height: ${p =>
    p.panelSize === 'max' ? 'calc(100vh - 120px)' : `calc(50vh - 80px)`};
  overflow-y: auto;
  z-index: 10;
`;

const MenuItem = styled('div')<{isSelected: boolean}>`
  padding: ${p => p.theme.space.md};
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
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.sm};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ItemDescription = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.xs};
`;
