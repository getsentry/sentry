import {Activity, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';

type MenuMode = 'slash-commands-keyboard' | 'pr-widget' | 'hidden';

interface SlashCommandHandlers {
  onFeedback: (() => void) | undefined;
  onNew: () => void;
  onCodeMode?: (value: 'off' | 'on' | 'only') => void;
  onConversations?: () => void;
  onLangfuse?: () => void;
  onMaxSize?: () => void;
  onMedSize?: () => void;
}

interface ExplorerMenuProps {
  clearInput: () => void;
  focusInput: () => void;
  inputValue: string;
  panelSize: 'max' | 'med';
  slashCommandHandlers: SlashCommandHandlers;
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
  inputAnchorRef?: React.RefObject<HTMLElement | null>;
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

/**
 * Custom floating menu for Seer Explorer slash commands and PR widget.
 */
export function useExplorerMenu({
  clearInput,
  inputValue,
  focusInput,
  textAreaRef,
  panelSize,
  slashCommandHandlers,
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

  // Menu items and select handlers change based on the mode.
  const menuItems = useMemo(() => {
    switch (menuMode) {
      case 'slash-commands-keyboard':
        return filteredSlashCommands;
      case 'pr-widget':
        return prWidgetItems ?? [];
      default:
        return [];
    }
  }, [menuMode, filteredSlashCommands, prWidgetItems]);

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

      // Default to closing the menu after an item is selected and handled.
      closeAndFocusInput();
    },
    // clearInput and textAreaRef are both expected to be stable.
    [menuMode, clearInput, textAreaRef, closeAndFocusInput]
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

    const anchorRef = menuMode === 'pr-widget' ? prWidgetAnchorRef : inputAnchorRef;

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

    if (menuMode === 'slash-commands-keyboard') {
      setMenuPosition({
        bottom: `${panelRect.height - relativeTop + spacing}px`,
        left: `${relativeLeft}px`,
      });
    } else {
      // Position above anchor (since button is at bottom of panel)
      setMenuPosition({
        bottom: `${panelRect.height - relativeTop + spacing}px`,
        right: `${panelRect.width - relativeLeft - rect.width}px`,
      });
    }
  }, [isVisible, menuMode, inputAnchorRef, prWidgetAnchorRef]);

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
        {menuMode === 'pr-widget' && prWidgetFooter}
      </MenuPanel>
    </Activity>
  );

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
    openPRWidget,
  };
}

function useSlashCommands({
  onMaxSize,
  onMedSize,
  onNew,
  onFeedback,
  onLangfuse,
  onConversations,
  onCodeMode,
}: SlashCommandHandlers): MenuItemProps[] {
  const isSentryEmployee = useIsSentryEmployee();

  return useMemo(
    (): MenuItemProps[] => [
      {
        title: '/new',
        key: '/new',
        description: 'Start a new session',
        handler: onNew,
      },
      ...(onMaxSize
        ? [
            {
              title: '/max-size',
              key: '/max-size',
              description: 'Expand panel to full viewport height',
              handler: onMaxSize,
            },
          ]
        : []),
      ...(onMedSize
        ? [
            {
              title: '/med-size',
              key: '/med-size',
              description: 'Set panel to medium size (default)',
              handler: onMedSize,
            },
          ]
        : []),
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
      ...(isSentryEmployee && onCodeMode
        ? [
            {
              title: '/code-mode-off',
              key: '/code-mode-off',
              description: 'Disable code mode tools',
              handler: () => onCodeMode('off'),
            },
            {
              title: '/code-mode-on',
              key: '/code-mode-on',
              description: 'Enable code mode tools alongside standard tools',
              handler: () => onCodeMode('on'),
            },
            {
              title: '/code-mode-only',
              key: '/code-mode-only',
              description: 'Use only code mode tools (no standard tools)',
              handler: () => onCodeMode('only'),
            },
          ]
        : []),
      ...(isSentryEmployee && onLangfuse
        ? [
            {
              title: '/langfuse',
              key: '/langfuse',
              description: 'Open Langfuse to view session details',
              handler: onLangfuse,
            },
          ]
        : []),
      ...(isSentryEmployee && onConversations
        ? [
            {
              title: '/conversations',
              key: '/conversations',
              description: 'Open Sentry AI trace (conversations view)',
              handler: onConversations,
            },
          ]
        : []),
    ],
    [
      onNew,
      onMaxSize,
      onMedSize,
      onFeedback,
      onCodeMode,
      onLangfuse,
      onConversations,
      isSentryEmployee,
    ]
  );
}

const MenuPanel = styled('div')<{
  panelSize: 'max' | 'med';
}>`
  position: absolute;
  width: 300px;
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  box-shadow: ${p => p.theme.shadow.high};
  max-height: ${p =>
    p.panelSize === 'max' ? 'calc(100vh - 120px)' : 'calc(50vh - 80px)'};
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
  font-size: ${p => p.theme.font.size.sm};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ItemDescription = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.xs};
`;
