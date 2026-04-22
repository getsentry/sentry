import {useCallback, useMemo, useState} from 'react';
import moment from 'moment-timezone';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {DrawerHeader} from '@sentry/scraps/drawer';
import {Flex} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {TimeSince} from 'sentry/components/timeSince';
import {IconEllipsis, IconAdd, IconTimer, IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useExplorerSessions} from 'sentry/views/seerExplorer/hooks/useExplorerSessions';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

interface ExplorerDrawerHeaderProps {
  copySessionEnabled: boolean;
  onChangeSession: (runId: number) => void;
  onCopySessionClick: () => void;
  onNewChatClick: () => void;
  onOverrideCodeModeEnableToggle: () => void;
  onOverrideCtxEngEnableToggle: () => void;
  overrideCodeModeEnable: boolean;
  overrideCtxEngEnable: boolean;
  showCodeModeToggle: boolean;
  showContextEngineToggle: boolean;
}

export function ExplorerDrawerHeader({
  onNewChatClick,
  onChangeSession,
  copySessionEnabled,
  onCopySessionClick,
  showContextEngineToggle,
  overrideCtxEngEnable,
  onOverrideCtxEngEnableToggle,
  showCodeModeToggle,
  overrideCodeModeEnable,
  onOverrideCodeModeEnableToggle,
}: ExplorerDrawerHeaderProps) {
  const [mode, setMode] = useState<'more-actions' | 'session-history'>('more-actions');

  // Session history query
  const {
    sessionMenuItems: rawSessionMenuItems,
    isPending,
    isError,
    refetch: refetchSessionHistory,
  } = useSessionMenuItems({
    onChangeSession,
  });

  const onOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      // Switch back to default actions on menu close
      setMode('more-actions');
    }
  }, []);

  // Default menu items
  const moreActions: MenuItemProps[] = useMemo(
    () => [
      {
        key: 'session-history',
        label: t('History'),
        leadingItems: <IconTimer />,
        onAction: () => {
          refetchSessionHistory();
          setMode('session-history');
        },
        closeOnSelect: false,
      },
      {
        key: 'copy-conversation',
        label: t('Copy conversation to clipboard'),
        leadingItems: <IconCopy />,
        onAction: onCopySessionClick,
        disabled: !copySessionEnabled,
      },
    ],
    [onCopySessionClick, copySessionEnabled, refetchSessionHistory]
  );

  // Session history menu items
  const sessionMenuItems = useMemo(() => {
    if (isError) {
      return [
        {
          key: 'session-history-error',
          label: t('Error loading session history.'),
          disabled: true,
        },
      ];
    }
    if (!isPending && rawSessionMenuItems.length === 0) {
      return [
        {
          key: 'session-history-empty',
          label: t('No previous sessions to show.'),
          disabled: true,
        },
      ];
    }
    return [
      ...rawSessionMenuItems,
      ...(isPending
        ? [
            {
              key: 'session-history-loading',
              label: t('Loading...'),
              disabled: true,
            },
          ]
        : []),
    ];
  }, [rawSessionMenuItems, isPending, isError]);

  const menuItems = useMemo(() => {
    if (mode === 'session-history') {
      return sessionMenuItems;
    }
    return moreActions;
  }, [mode, sessionMenuItems, moreActions]);

  return (
    <DrawerHeader hideBar hideCloseButtonText>
      <FeatureBadge
        type="beta"
        tooltipProps={{title: t('This feature is in beta and may change')}}
      />
      <Flex flex="1" />
      <Flex gap="md">
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
          items={menuItems}
          size="xs"
          position="bottom-end"
          onOpenChange={onOpenChange}
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
      </Flex>
    </DrawerHeader>
  );
}

function useSessionMenuItems({
  onChangeSession,
  enabled = true,
}: {
  onChangeSession: (runId: number) => void;
  enabled?: boolean;
}): {
  isError: boolean;
  isPending: boolean;
  refetch: () => void;
  sessionMenuItems: MenuItemProps[];
} {
  const organization = useOrganization({allowNull: true});
  const hasFeature = organization ? isSeerExplorerEnabled(organization) : false;

  const {data, isPending, isError, refetch} = useExplorerSessions({
    limit: 20,
    enabled: enabled && hasFeature,
  });

  const sessionMenuItems = useMemo(() => {
    return (
      data?.data.map(
        (session: {
          last_triggered_at: moment.MomentInput;
          run_id: number;
          title: any;
        }) => ({
          key: 'session-' + session.run_id.toString(),
          label: session.title,
          details: (
            <TimeSince
              tooltipPrefix="Last updated"
              date={moment.utc(session.last_triggered_at).toDate()}
              suffix="ago"
            />
          ),
          onAction: () => onChangeSession(session.run_id),
        })
      ) ?? []
    );
  }, [data, onChangeSession]);

  return {
    sessionMenuItems,
    isPending,
    isError,
    refetch,
  };
}
