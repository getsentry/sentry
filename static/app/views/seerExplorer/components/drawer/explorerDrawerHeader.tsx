import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {DrawerHeader} from '@sentry/scraps/drawer';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {TimeSince} from 'sentry/components/timeSince';
import {
  IconAdd,
  IconClock,
  IconCopy,
  IconEllipsis,
  IconLink,
  IconWindow,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useSeerExplorerSessionsQuery} from 'sentry/views/seerExplorer/seerExplorerSessionContext';

interface ExplorerDrawerHeaderProps {
  isPipSupported: boolean;
  isPoppedOut: boolean;
  onChangeSession: (runId: number) => void;
  onCopyLinkClick: (() => void) | undefined;
  onCopySessionClick: (() => void) | undefined;
  onNewChatClick: () => void;
  onOverrideCtxEngEnableToggle: () => void;
  onShowThinkingToggle: () => void;
  onTogglePictureInPicture: () => void;
  overrideCtxEngEnable: boolean;
  showContextEngineToggle: boolean;
  showThinking: boolean;
  showThinkingToggle: boolean;
  disableNewChatButton?: boolean;
}

export function ExplorerDrawerHeader({
  onNewChatClick,
  onChangeSession,
  onCopySessionClick,
  onCopyLinkClick,
  showContextEngineToggle,
  overrideCtxEngEnable,
  onOverrideCtxEngEnableToggle,
  showThinking,
  showThinkingToggle,
  onShowThinkingToggle,
  isPipSupported,
  isPoppedOut,
  onTogglePictureInPicture,
  disableNewChatButton = false,
}: ExplorerDrawerHeaderProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  const {data, isFetching, isError, refetch} = useSeerExplorerSessionsQuery({
    query: debouncedSearch || undefined,
  });

  const isSearchPending = search !== debouncedSearch;
  const sessionOptions = useMemo(() => {
    if (isSearchPending || isFetching) {
      return [];
    }
    return (
      data?.data.map(session => ({
        value: session.run_id,
        label: session.title,
        details: (
          <TimeSince
            tooltipPrefix="Last updated"
            date={moment.utc(session.last_triggered_at).toDate()}
            suffix="ago"
          />
        ),
      })) ?? []
    );
  }, [data, isSearchPending, isFetching]);

  const onHistoryOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        refetch();
      } else {
        setSearch('');
      }
    },
    [refetch]
  );

  const overflowMenuItems: MenuItemProps[] = useMemo(
    () => [
      {
        key: 'copy-session',
        label: t('Copy conversation to clipboard'),
        onAction: onCopySessionClick ?? undefined,
        disabled: !onCopySessionClick,
        leadingItems: <IconCopy />,
      },
      {
        key: 'copy-link',
        label: t('Copy link to current chat'),
        onAction: onCopyLinkClick ?? undefined,
        disabled: !onCopyLinkClick,
        leadingItems: <IconLink />,
      },
    ],
    [onCopySessionClick, onCopyLinkClick]
  );

  return (
    <DrawerHeader hideBar hideCloseButtonText hideCloseButton={isPoppedOut}>
      <Flex align="center" gap="xs" height="100%">
        <Text wrap="nowrap" size="md">
          {t('Seer Agent')}
        </Text>
        <FeatureBadge
          type="beta"
          tooltipProps={{title: t('This feature is in beta and may change')}}
        />
      </Flex>
      <Flex flex="1" />
      <Flex gap="sm">
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
        {showThinkingToggle && (
          <Tooltip
            title={
              showThinking
                ? t('Hide thinking blocks (click to hide)')
                : t('Show thinking blocks (click to show)')
            }
          >
            <Flex align="center" gap="xs" padding="xs sm" height="100%">
              <Switch
                size="sm"
                checked={showThinking}
                onChange={onShowThinkingToggle}
                aria-label={t('Toggle thinking blocks')}
              />
              <Text size="sm" variant="muted">
                {t('Show thinking')}
              </Text>
            </Flex>
          </Tooltip>
        )}
        <Flex gap="0" align="center">
          <InlineActions>
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
          </InlineActions>
          <OverflowActions>
            <DropdownMenu
              items={overflowMenuItems}
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
          </OverflowActions>
          {isPipSupported && (
            <Button
              icon={<IconWindow />}
              onClick={onTogglePictureInPicture}
              variant="transparent"
              size="xs"
              aria-label={
                isPoppedOut ? t('Dock back into drawer') : t('Open in a separate window')
              }
              tooltipProps={{
                title: isPoppedOut
                  ? t('Dock back into drawer')
                  : t('Open in a separate window'),
              }}
            />
          )}
          <CompactSelect
            options={sessionOptions}
            value={undefined}
            disabled={false}
            onChange={option => onChangeSession(option.value)}
            onOpenChange={onHistoryOpenChange}
            loading={isFetching || search !== debouncedSearch}
            emptyMessage={isError ? t('Error loading session history.') : ' '}
            search={{
              filter: false,
              onChange: setSearch,
              placeholder: t('Search chats…'),
            }}
            menuTitle={t('Chat history')}
            position="bottom-end"
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
        </Flex>
        <OverflowActions>
          <Button
            icon={<IconAdd />}
            onClick={onNewChatClick}
            disabled={disableNewChatButton}
            variant="secondary"
            size="xs"
            aria-label={t('Start a new chat (/new)')}
            tooltipProps={{title: t('Start a new chat (/new)')}}
          />
        </OverflowActions>
        <InlineActions>
          <Button
            icon={<IconAdd />}
            onClick={onNewChatClick}
            disabled={disableNewChatButton}
            variant="secondary"
            size="xs"
            aria-label={t('Start a new chat (/new)')}
            tooltipProps={{title: t('Start a new chat (/new)')}}
          >
            {t('New chat')}
          </Button>
        </InlineActions>
      </Flex>
    </DrawerHeader>
  );
}

const InlineActions = styled(Flex)`
  gap: 0;

  @container seer-explorer-root (max-width: 500px) {
    display: none;
  }
`;

const OverflowActions = styled('div')`
  display: none;

  @container seer-explorer-root (max-width: 500px) {
    display: block;
  }
`;
