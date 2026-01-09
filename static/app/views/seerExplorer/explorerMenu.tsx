import {Activity, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import TimeSince from 'sentry/components/timeSince';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import useOrganization from 'sentry/utils/useOrganization';
import {useExplorerSessions} from 'sentry/views/seerExplorer/hooks/useExplorerSessions';

type MenuMode = 'slash-commands-keyboard' | 'session-history' | 'pr-widget' | 'hidden';

interface ExplorerMenuProps {
  clearInput: () => void;
  focusInput: () => void;
  inputValue: string;
  onChangeSession: (runId: number) => void;
  panelSize: 'max' | 'med';
  panelVisible: boolean;
  slashCommandHandlers: {
    onFeedback: (() => void) | undefined;
    onLangfuse: () => void;
    onMaxSize: () => void;
    onMedSize: () => void;
    onNew: () => void;
  };
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
  inputAnchorRef?: React.RefObject<HTMLElement | null>;
  menuAnchorRef?: React.RefObject<HTMLElement | null>;
  prWidgetAnchorRef?: React.RefObject<HTMLElement | null>;
  prWidgetFooter?: React.ReactNode;
  prWidgetItems?: MenuItemProps[];
}

export interface MenuItemProps {
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
  menuAnchorRef,
  inputAnchorRef,
  prWidgetAnchorRef,
  prWidgetItems,
  prWidgetFooter,
}: ExplorerMenuProps) {
  const [menuMode, setMenuMode] = useState<MenuMode>('hidden');
  const [menuPosition, setMenuPosition] = useState<{
    bottom?: string | number;
    left?: string | number;
    right?: string | number;
    top?: string | number;
  }>({});

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
      case 'session-history':
        return sessionItems;
      case 'pr-widget':
        return prWidgetItems ?? [];
      default:
        return [];
    }
  }, [menuMode, filteredSlashCommands, sessionItems, prWidgetItems]);

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
      } else if (menuMode === 'session-history') {
        // When resuming a session, just close without focusing input.
        close();
      } else {
        // Default to closing the menu after an item is selected and handled.
        closeAndFocusInput();
      }
    },
    // clearInput and textAreaRef are both expected to be stable.
    [
      menuMode,
      clearInput,
      textAreaRef,
      setMenuMode,
      refetchSessions,
      close,
      closeAndFocusInput,
    ]
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

  // Calculate menu position based on anchor element
  useEffect(() => {
    if (!isVisible) {
      setMenuPosition({});
      return;
    }

    const anchorRef =
      menuMode === 'slash-commands-keyboard'
        ? inputAnchorRef
        : menuMode === 'pr-widget'
          ? prWidgetAnchorRef
          : menuAnchorRef;
    const isSlashCommand = menuMode === 'slash-commands-keyboard';

    if (!anchorRef?.current) {
      setMenuPosition({
        bottom: '100%',
        left: '16px',
      });
      return;
    }

    const rect = anchorRef.current.getBoundingClientRect();
    const panelRect = anchorRef.current
      .closest('[data-seer-explorer-root]')
      ?.getBoundingClientRect();

    if (!panelRect) {
      return;
    }

    const spacing = 8;
    const relativeTop = rect.top - panelRect.top;
    const relativeLeft = rect.left - panelRect.left;

    if (isSlashCommand) {
      setMenuPosition({
        bottom: `${panelRect.height - relativeTop + spacing}px`,
        left: `${relativeLeft}px`,
      });
    } else if (menuMode === 'pr-widget') {
      // Position below anchor, centered
      setMenuPosition({
        top: `${relativeTop + rect.height + spacing}px`,
        left: `${relativeLeft - rect.width - spacing}px`,
      });
    } else {
      setMenuPosition({
        top: `${relativeTop + rect.height + spacing}px`,
        left: `${relativeLeft}px`,
      });
    }
  }, [isVisible, menuMode, menuAnchorRef, inputAnchorRef, prWidgetAnchorRef]);

  const menu = (
    <Activity mode={isVisible ? 'visible' : 'hidden'}>
      <MenuPanel panelSize={panelSize} style={menuPosition} data-seer-menu-panel="">
        {menuItems.map((item: MenuItemProps, index: number) => (
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
        {menuMode === 'pr-widget' && prWidgetFooter}
      </MenuPanel>
    </Activity>
  );

  // Handler for opening session history from button
  const openSessionHistory = useCallback(() => {
    if (menuMode === 'session-history') {
      close();
    } else {
      setMenuMode('session-history');
      refetchSessions();
    }
  }, [menuMode, close, refetchSessions]);

  // Handler for opening PR widget from button
  const openPRWidget = useCallback(() => {
    if (menuMode === 'pr-widget') {
      close();
    } else {
      setMenuMode('pr-widget');
    }
  }, [menuMode, close]);

  return {
    menu,
    menuMode,
    isMenuOpen: menuMode !== 'hidden',
    closeMenu: close,
    openSessionHistory,
    openPRWidget,
  };
}

function useSlashCommands({
  onMaxSize,
  onMedSize,
  onNew,
  onFeedback,
  onLangfuse,
}: {
  onFeedback: (() => void) | undefined;
  onLangfuse: () => void;
  onMaxSize: () => void;
  onMedSize: () => void;
  onNew: () => void;
}): MenuItemProps[] {
  const isSentryEmployee = useIsSentryEmployee();

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
      ...(onFeedback
        ? [
            {
              title: '/feedback',
              key: '/feedback',
              description: 'Open feedback form to report issues or suggestions',
              handler: () => onFeedback(),
            },
          ]
        : []),
      ...(isSentryEmployee
        ? [
            {
              title: '/langfuse',
              key: '/langfuse',
              description: 'Open Langfuse to view session details',
              handler: onLangfuse,
            },
          ]
        : []),
    ],
    [onNew, onMaxSize, onMedSize, onFeedback, onLangfuse, isSentryEmployee]
  );
}

function useSessions({
  onChangeSession,
  enabled,
}: {
  onChangeSession: (runId: number) => void;
  enabled?: boolean;
}) {
  const organization = useOrganization({allowNull: true});
  const hasFeature = organization?.features.includes('seer-explorer');

  const {data, isPending, isError, refetch} = useExplorerSessions({
    limit: 20,
    enabled: enabled && hasFeature,
  });

  const sessionItems = useMemo(() => {
    if (isPending || isError) {
      return [];
    }

    return data.data.map(
      (session: {last_triggered_at: moment.MomentInput; run_id: number; title: any}) => ({
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
      })
    );
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
  width: 300px;
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  max-height: ${p =>
    p.panelSize === 'max' ? 'calc(100vh - 120px)' : `calc(50vh - 80px)`};
  overflow-y: auto;
  z-index: 10;
`;

const MenuItem = styled('div')<{isSelected: boolean}>`
  padding: ${p => p.theme.space.md};
  cursor: pointer;
  background: ${p =>
    p.isSelected
      ? p.theme.tokens.interactive.transparent.neutral.background.active
      : 'transparent'};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }
`;

const ItemName = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ItemDescription = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.xs};
`;
