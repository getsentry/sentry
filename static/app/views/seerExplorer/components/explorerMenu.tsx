import {Activity, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {IconSlashForward} from '@sentry/icons/slashForward';

import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Container} from '@sentry/scraps/layout';
import {ListItem, SECTION_ITEM_SPACE, SectionList} from '@sentry/scraps/menu';
import {Overlay} from '@sentry/scraps/overlay';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';

interface SlashCommandHandlers {
  onFeedback: (() => void) | undefined;
  onNew: () => void;
  /** `/investigate` runs when sent, since it takes a question, so the menu only completes it. */
  canInvestigate?: boolean;
  onBashMode?: (value: boolean) => void;
  onConversations?: () => void;
  onMaxSize?: () => void;
  onMedSize?: () => void;
}

interface ExplorerMenuProps {
  clearInput: () => void;
  /** Replaces the input with `text`, leaving the caret after it. */
  completeInput: (text: string) => void;
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
  key: string;
  title: string;
  /** Omitted for a command that takes text after it: selecting it completes the input. */
  handler?: () => void;
}

/**
 * Custom floating menu for Seer Explorer slash commands.
 */
export function useExplorerMenu({
  clearInput,
  completeInput,
  inputValue,
  focusInput,
  composerRef,
  panelSize,
  slashCommandHandlers,
  inputAnchorRef,
}: ExplorerMenuProps) {
  const [toolbarMenuContainer, setToolbarMenuContainer] = useState<HTMLElement | null>(
    null
  );
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
  const isVisible = menuItems.length > 0 && !toolbarMenuContainer;

  // The menu only shows while the input is a partial slash command, so
  // clearing the input is what closes it.
  const close = useCallback(() => {
    if (menuItems.length === 0) {
      return;
    }
    clearInput();
    if (composerRef.current) {
      composerRef.current.style.height = 'auto';
    }
  }, [menuItems.length, clearInput, composerRef]);

  const closeAndFocusInput = useCallback(() => {
    close();
    focusInput();
  }, [close, focusInput]);

  const onSelect = useCallback(
    (item: MenuItemProps) => {
      if (!item.handler) {
        // The trailing space hides the menu, as it does for anything typed after a command.
        completeInput(`${item.title} `);
        return;
      }
      item.handler();
      closeAndFocusInput();
    },
    [completeInput, closeAndFocusInput]
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuItemRefs = useRef<Array<HTMLLIElement | null>>([]);

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
      setMenuPosition({bottom: '100%', left: '16px'});
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
      {/* Built from the same Scraps pieces as the toolbar's DropdownMenu, so the
          two slash command menus look the same. */}
      <Overlay
        style={{
          ...menuPosition,
          position: 'absolute',
          overflowY: 'auto',
          maxHeight: panelSize === 'max' ? 'calc(100vh - 120px)' : 'calc(50vh - 80px)',
        }}
        data-seer-menu-panel=""
      >
        <SectionList margin="xs 0" gap={SECTION_ITEM_SPACE}>
          {menuItems.map((item: MenuItemProps, index: number) => (
            <ListItem
              key={item.key}
              ref={(el: HTMLLIElement | null) => {
                menuItemRefs.current[index] = el;
              }}
              size="sm"
              label={item.title}
              details={<SlashCommandDetails>{item.description}</SlashCommandDetails>}
              isFocused={index === selectedIndex}
              innerWrapProps={{
                onPointerEnter: () => setSelectedIndex(index),
                onClick: () => onSelect(item),
              }}
            />
          ))}
        </SectionList>
      </Overlay>
    </Activity>
  );

  return {
    menu,
    toolbarMenu: (
      <DropdownMenu
        items={allSlashCommands.map(item => ({
          key: item.key,
          label: item.title,
          details: <SlashCommandDetails>{item.description}</SlashCommandDetails>,
          onAction: () => onSelect(item),
        }))}
        position="top-start"
        strategy="fixed"
        usePortal
        portalContainerRef={{current: toolbarMenuContainer}}
        onOpenChange={isOpen =>
          setToolbarMenuContainer(
            isOpen ? (composerRef.current?.ownerDocument.body ?? document.body) : null
          )
        }
        size="sm"
        trigger={triggerProps => (
          <OverlayTrigger.IconButton
            {...triggerProps}
            icon={<IconSlashForward />}
            aria-label={t('Commands')}
            tooltipProps={{title: t('Commands')}}
            variant="transparent"
            size="zero"
          />
        )}
      />
    ),
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
  canInvestigate,
}: SlashCommandHandlers): MenuItemProps[] {
  const isSentryEmployee = useIsSentryEmployee();

  return useMemo(
    (): MenuItemProps[] => [
      {title: '/new', key: '/new', description: 'Start a new session', handler: onNew},
      ...(canInvestigate
        ? [
            {
              title: '/investigate',
              key: '/investigate',
              description:
                'Start an investigation of this page. Add a question after the command to focus it',
            },
          ]
        : []),
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
      onConversations,
      canInvestigate,
      isSentryEmployee,
    ]
  );
}

function SlashCommandDetails({children}: {children: React.ReactNode}) {
  return (
    <Container width="320px" maxWidth="calc(100vw - 64px)">
      {children}
    </Container>
  );
}
