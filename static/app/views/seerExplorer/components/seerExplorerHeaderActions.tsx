import type {ReactNode} from 'react';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {
  IconCheckmark,
  IconClock,
  IconCopy,
  IconEllipsis,
  IconLink,
  IconPanel,
  IconWindow,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {
  SeerExplorerRunId,
  SeerExplorerSidebarPosition,
} from 'sentry/views/seerExplorer/types';

const POSITION_ICON_DIRECTION = {
  auto: undefined,
  right: 'right',
  bottom: 'down',
} as const satisfies Record<SeerExplorerSidebarPosition, string | undefined>;

interface SessionOption {
  details: ReactNode;
  label: string;
  value: SeerExplorerRunId;
}

/**
 * The "middle" cluster of header actions (copy, dock/pop-out, chat history).
 * Rendered in two shapes — {@link SeerExplorerHeaderActions} lays them out as
 * inline buttons, {@link SeerExplorerHeaderActionsMenu} folds them into a single
 * overflow menu.
 */
export interface SeerExplorerHeaderActionsProps {
  isPipSupported: boolean;
  isPoppedOut: boolean;
  onChangeSession: (runId: SeerExplorerRunId) => void;
  onCopyLinkClick: (() => void) | undefined;
  onCopySessionClick: (() => void) | undefined;
  onHistoryOpenChange: (isOpen: boolean) => void;
  onSearchChange: (search: string) => void;
  onTogglePictureInPicture: () => void;
  sessionOptions: SessionOption[];
  sessionsError: boolean;
  sessionsLoading: boolean;
  onSidebarPositionChange?: (position: SeerExplorerSidebarPosition) => void;
  sidebarPosition?: SeerExplorerSidebarPosition;
}

function ChatHistorySelect({
  sessionOptions,
  sessionsLoading,
  sessionsError,
  onChangeSession,
  onHistoryOpenChange,
  onSearchChange,
}: Pick<
  SeerExplorerHeaderActionsProps,
  | 'sessionOptions'
  | 'sessionsLoading'
  | 'sessionsError'
  | 'onChangeSession'
  | 'onHistoryOpenChange'
  | 'onSearchChange'
>) {
  return (
    <CompactSelect
      options={sessionOptions}
      value={undefined}
      disabled={false}
      onChange={option => onChangeSession(option.value)}
      onOpenChange={onHistoryOpenChange}
      loading={sessionsLoading}
      emptyMessage={sessionsError ? t('Error loading session history.') : ' '}
      search={{
        filter: false,
        onChange: onSearchChange,
        placeholder: t('Search chats\u2026'),
      }}
      menuTitle={t('Chat history')}
      // Seer's panel is a right-docked pane with `overflow: hidden` ancestors,
      // and CompactSelect renders its overlay inline (no portal), so `strategy:
      // 'fixed'` is needed to escape that clip. To pin the menu flush against
      // the panel's right edge, over-push it right and let `preventOverflow` clamp
      // its right edge.
      strategy="fixed"
      position="bottom-end"
      offset={[100, 8]}
      preventOverflowOptions={{
        boundary: document.body,
      }}
      size="xs"
      menuWidth={320}
      trigger={triggerProps => (
        <OverlayTrigger.IconButton
          {...triggerProps}
          aria-label={t('Chat history')}
          tooltipProps={{title: t('Chat history')}}
          icon={<IconClock />}
          variant="transparent"
          size="xs"
        />
      )}
    />
  );
}

export function SeerExplorerHeaderActions({
  onCopySessionClick,
  onCopyLinkClick,
  isPipSupported,
  isPoppedOut,
  onTogglePictureInPicture,
  sidebarPosition = 'auto',
  onSidebarPositionChange,
  sessionOptions,
  sessionsLoading,
  sessionsError,
  onChangeSession,
  onHistoryOpenChange,
  onSearchChange,
}: SeerExplorerHeaderActionsProps) {
  const positionMenuItems: MenuItemProps[] = [
    {
      key: 'auto',
      label: t('Auto'),
      leadingItems: <IconPanel />,
      trailingItems: sidebarPosition === 'auto' ? <IconCheckmark size="sm" /> : null,
      onAction: () => onSidebarPositionChange?.('auto'),
    },
    {
      key: 'right',
      label: t('Right'),
      leadingItems: <IconPanel direction="right" />,
      trailingItems: sidebarPosition === 'right' ? <IconCheckmark size="sm" /> : null,
      onAction: () => onSidebarPositionChange?.('right'),
    },
    {
      key: 'bottom',
      label: t('Bottom'),
      leadingItems: <IconPanel direction="down" />,
      trailingItems: sidebarPosition === 'bottom' ? <IconCheckmark size="sm" /> : null,
      onAction: () => onSidebarPositionChange?.('bottom'),
    },
    ...(isPipSupported
      ? [
          {
            key: 'windowed',
            label: t('Windowed'),
            leadingItems: <IconWindow />,
            onAction: onTogglePictureInPicture,
          },
        ]
      : []),
  ];

  return (
    <Flex align="center">
      <Button
        icon={<IconCopy />}
        onClick={onCopySessionClick}
        disabled={!onCopySessionClick}
        variant="transparent"
        size="xs"
        aria-label={t('Copy conversation to clipboard')}
        tooltipProps={{title: t('Copy conversation to clipboard')}}
      />
      <Button
        icon={<IconLink />}
        onClick={onCopyLinkClick}
        disabled={!onCopyLinkClick}
        variant="transparent"
        size="xs"
        aria-label={t('Copy link to current chat and web page')}
        tooltipProps={{title: t('Copy link to current chat and web page')}}
      />
      {/* Drawer-only pop-out button (in sidebar mode the toggle lives in the
          dock-position menu as the `Windowed` item). Hidden once popped out —
          the floating window is dismissed via its close button or Escape. */}
      {isPipSupported && !onSidebarPositionChange && !isPoppedOut && (
        <Button
          icon={<IconWindow />}
          onClick={onTogglePictureInPicture}
          variant="transparent"
          size="xs"
          aria-label={t('Open in a separate window')}
          tooltipProps={{title: t('Open in a separate window')}}
        />
      )}
      {!isPoppedOut && onSidebarPositionChange && (
        <DropdownMenu
          items={positionMenuItems}
          size="xs"
          position="bottom-end"
          menuTitle={t('Dock position')}
          triggerProps={{
            tooltipProps: {
              title: t('Dock position'),
            },
            'aria-label': t('Dock position'),
            icon: <IconPanel direction={POSITION_ICON_DIRECTION[sidebarPosition]} />,
            showChevron: false,
            variant: 'transparent',
            size: 'xs',
          }}
        />
      )}
      <ChatHistorySelect
        sessionOptions={sessionOptions}
        sessionsLoading={sessionsLoading}
        sessionsError={sessionsError}
        onChangeSession={onChangeSession}
        onHistoryOpenChange={onHistoryOpenChange}
        onSearchChange={onSearchChange}
      />
    </Flex>
  );
}

export function SeerExplorerHeaderActionsMenu({
  onCopySessionClick,
  onCopyLinkClick,
  isPipSupported,
  isPoppedOut,
  onTogglePictureInPicture,
  sidebarPosition = 'auto',
  onSidebarPositionChange,
  sessionOptions,
  sessionsLoading,
  sessionsError,
  onChangeSession,
  onHistoryOpenChange,
  onSearchChange,
}: SeerExplorerHeaderActionsProps) {
  const dockItem: MenuItemProps | null =
    !isPoppedOut && onSidebarPositionChange
      ? {
          key: 'dock-position',
          label: t('Dock position'),
          leadingItems: (
            <IconPanel direction={POSITION_ICON_DIRECTION[sidebarPosition]} />
          ),
          submenu: {position: 'left-start'},
          children: [
            {
              key: 'auto',
              label: t('Auto'),
              leadingItems: <IconPanel />,
              trailingItems:
                sidebarPosition === 'auto' ? <IconCheckmark size="sm" /> : null,
              onAction: () => onSidebarPositionChange('auto'),
            },
            {
              key: 'right',
              label: t('Right'),
              leadingItems: <IconPanel direction="right" />,
              trailingItems:
                sidebarPosition === 'right' ? <IconCheckmark size="sm" /> : null,
              onAction: () => onSidebarPositionChange('right'),
            },
            {
              key: 'bottom',
              label: t('Bottom'),
              leadingItems: <IconPanel direction="down" />,
              trailingItems:
                sidebarPosition === 'bottom' ? <IconCheckmark size="sm" /> : null,
              onAction: () => onSidebarPositionChange('bottom'),
            },
            ...(isPipSupported
              ? [
                  {
                    key: 'windowed',
                    label: t('Windowed'),
                    leadingItems: <IconWindow />,
                    onAction: onTogglePictureInPicture,
                  },
                ]
              : []),
          ],
        }
      : isPipSupported && !isPoppedOut
        ? {
            key: 'windowed',
            label: t('Open in a separate window'),
            leadingItems: <IconWindow />,
            onAction: onTogglePictureInPicture,
          }
        : null;

  const items: MenuItemProps[] = [
    {
      key: 'copy-link',
      label: t('Link to chat'),
      leadingItems: <IconLink />,
      onAction: onCopyLinkClick ?? undefined,
      disabled: !onCopyLinkClick,
    },
    {
      key: 'copy-session',
      label: t('Copy conversation to clipboard'),
      leadingItems: <IconCopy />,
      onAction: onCopySessionClick ?? undefined,
      disabled: !onCopySessionClick,
    },
    ...(dockItem ? [dockItem] : []),
  ];

  return (
    <Flex align="center">
      <DropdownMenu
        items={items}
        size="xs"
        position="bottom-end"
        triggerProps={{
          'aria-label': t('More actions'),
          icon: <IconEllipsis />,
          showChevron: false,
          variant: 'transparent',
          size: 'xs',
        }}
      />
      {/* Chat history keeps its own searchable dropdown here rather than
          collapsing into the overflow menu — the DropdownMenu has no search,
          so a submenu couldn't offer the same filtering the inline actions do. */}
      <ChatHistorySelect
        sessionOptions={sessionOptions}
        sessionsLoading={sessionsLoading}
        sessionsError={sessionsError}
        onChangeSession={onChangeSession}
        onHistoryOpenChange={onHistoryOpenChange}
        onSearchChange={onSearchChange}
      />
    </Flex>
  );
}
