import {Activity, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';

interface SlashCommandHandlers {
  onFeedback: (() => void) | undefined;
  onNew: () => void;
  onBashMode?: (value: boolean) => void;
  onCodeMode?: (value: 'off' | 'on' | 'only') => void;
  onConversations?: () => void;
  onMaxSize?: () => void;
  onMedSize?: () => void;
}

interface ExplorerMenuProps {
  clearInput: () => void;
  // Only used for `.style.height` resets and anchor positioning, both of
  // which work against any element, so this stays valid if the input is
  // ever backed by something other than a <textarea>.
  composerRef: React.RefObject<HTMLElement | null>;
  focusInput: () => void;
  inputValue: string;
  panelSize: 'max' | 'med';
  slashCommandHandlers: SlashCommandHandlers;
  inputAnchorRef?: React.RefObject<HTMLElement | null>;
}

export interface MenuItemProps {
  description: string | React.ReactNode;
  handler: () => void;
  key: string;
  title: string;
}

/**
 * Custom floating menu for Seer Explorer slash commands.
 */
export function useExplorerMenu({
  clearInput,
  inputValue,
  focusInput,
  composerRef,
  panelSize,
  slashCommandHandlers,
  inputAnchorRef,
}: ExplorerMenuProps) {
  const [menuPosition, setMenuPosition] = useState<{
    bottom?: string | number;
    left?: string | number;
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

  const menuItems = filteredSlashCommands;
  const isVisible = menuItems.length > 0;

  // The menu only shows while the input is a partial slash command, so
  // clearing the input is what closes it.
  const close = useCallback(() => {
    if (!isVisible) {
      return;
    }
    clearInput();
    if (composerRef.current) {
      composerRef.current.style.height = 'auto';
    }
  }, [isVisible, clearInput, composerRef]);

  const closeAndFocusInput = useCallback(() => {
    close();
    focusInput();
  }, [close, focusInput]);

  const onSelect = useCallback(
    (item: MenuItemProps) => {
      item.handler();
      closeAndFocusInput();
    },
    [closeAndFocusInput]
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuItemRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Reset selected index when items change
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setSelectedIndex(0);
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
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
      if (!isVisible) {
        return;
      }

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
      }
    },
    [isVisible, selectedIndex, menuItems, onSelect, closeAndFocusInput]
  );

  useEffect(() => {
    if (isVisible) {
      const ownerDocument = composerRef.current?.ownerDocument ?? document;
      // Use capture phase to intercept events before they reach other handlers
      ownerDocument.addEventListener('keydown', handleKeyDown, true);
      return () => ownerDocument.removeEventListener('keydown', handleKeyDown, true);
    }
    return;
  }, [composerRef, handleKeyDown, isVisible]);

  // Calculate menu position based on anchor element
  useEffect(() => {
    if (!isVisible) {
      // oxlint-disable-next-line react/set-state-in-effect
      setMenuPosition({});
      return;
    }

    if (!inputAnchorRef?.current) {
      setMenuPosition({
        bottom: '100%',
        left: '16px',
      });
      return;
    }

    const rect = inputAnchorRef.current.getBoundingClientRect();
    const panelRect = inputAnchorRef.current
      .closest('[data-seer-explorer-root]')
      ?.getBoundingClientRect();

    if (!panelRect) {
      return;
    }

    const spacing = 8;
    const relativeTop = rect.top - panelRect.top;
    const relativeLeft = rect.left - panelRect.left;

    // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
    setMenuPosition({
      bottom: `${panelRect.height - relativeTop + spacing}px`,
      left: `${relativeLeft}px`,
    });
  }, [isVisible, inputAnchorRef]);

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
      </MenuPanel>
    </Activity>
  );

  return {
    menu,
    isMenuOpen: isVisible,
    closeMenu: close,
  };
}

function useSlashCommands({
  onBashMode,
  onMaxSize,
  onMedSize,
  onNew,
  onFeedback,
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
      ...(isSentryEmployee && onBashMode
        ? [
            {
              title: '/bash-mode-off',
              key: '/bash-mode-off',
              description: 'Disable bash mode tools',
              handler: () => onBashMode(false),
            },
            {
              title: '/bash-mode-on',
              key: '/bash-mode-on',
              description: 'Enable bash mode tools',
              handler: () => onBashMode(true),
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
      onBashMode,
      onCodeMode,
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
