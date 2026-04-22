import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {DrawerHeader} from '@sentry/scraps/drawer';
import {Flex} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconEllipsis, IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';

interface ExplorerDrawerHeaderProps {
  copySessionEnabled: boolean;
  onCopySessionClick: () => void;
  onNewChatClick: () => void;
  onOverrideCodeModeEnableToggle: () => void;
  onOverrideCtxEngEnableToggle: () => void;
  onSessionHistoryClick: () => void;
  overrideCodeModeEnable: boolean;
  overrideCtxEngEnable: boolean;
  showCodeModeToggle: boolean;
  showContextEngineToggle: boolean;
}

export function ExplorerDrawerHeader({
  onNewChatClick,
  showContextEngineToggle,
  overrideCtxEngEnable,
  onOverrideCtxEngEnableToggle,
  showCodeModeToggle,
  overrideCodeModeEnable,
  onOverrideCodeModeEnableToggle,
  copySessionEnabled,
  onCopySessionClick,
  onSessionHistoryClick,
}: ExplorerDrawerHeaderProps) {
  const menuItems: MenuItemProps[] = useMemo(
    () => [
      {
        key: 'session-history',
        label: t('History'),
        tooltipProps: {title: t('Resume a previous chat (/resume)')},
        hidden: false,
        disabled: false,
        onAction: onSessionHistoryClick,
      },
      ...(copySessionEnabled
        ? [
            {
              key: 'copy-conversation',
              label: t('Copy conversation to clipboard'),
              hidden: false,
              disabled: false,
              onAction: onCopySessionClick,
            },
          ]
        : []),
    ],
    [onCopySessionClick, copySessionEnabled, onSessionHistoryClick]
  );

  return (
    <DrawerHeader hideBar hideCloseButtonText>
      <RightAlignedContent>
        {showContextEngineToggle && (
          <Tooltip
            title={
              overrideCtxEngEnable
                ? t('Context engine enabled (click to disable)')
                : t('Context engine disabled (click to enable)')
            }
          >
            <Flex align="center" gap="xs" padding="xs sm" height="100%">
              <Switch
                size="sm"
                checked={overrideCtxEngEnable}
                onChange={onOverrideCtxEngEnableToggle}
                aria-label={t('Toggle context engine')}
              />
              <Text size="sm" variant="muted">
                {t('CE')}
              </Text>
            </Flex>
          </Tooltip>
        )}
        {showCodeModeToggle && (
          <Tooltip
            title={
              overrideCodeModeEnable
                ? t('Code mode enabled (click to disable)')
                : t('Code mode disabled (click to enable)')
            }
          >
            <Flex align="center" gap="xs" padding="xs sm" height="100%">
              <Switch
                size="sm"
                checked={overrideCodeModeEnable}
                onChange={onOverrideCodeModeEnableToggle}
                aria-label={t('Toggle code mode')}
              />
              <Text size="sm" variant="muted">
                {t('CM')}
              </Text>
            </Flex>
          </Tooltip>
        )}
        <DropdownMenu
          size="sm"
          items={menuItems}
          triggerProps={{
            'aria-label': t('More actions'),
            tooltipProps: {title: t('More actions')},
            icon: <IconEllipsis />,
            showChevron: false,
            priority: 'transparent',
            size: 'zero',
          }}
        />
        <Button
          icon={<IconAdd />}
          onClick={onNewChatClick}
          priority="default"
          size="xs"
          aria-label={t('Start a new chat (/new)')}
          tooltipProps={{title: t('Start a new chat (/new)')}}
        >
          {t('New chat')}
        </Button>
      </RightAlignedContent>
    </DrawerHeader>
  );
}

const RightAlignedContent = styled('div')`
  margin-left: auto;
  display: flex;
  gap: ${p => p.theme.space.md};
`;
