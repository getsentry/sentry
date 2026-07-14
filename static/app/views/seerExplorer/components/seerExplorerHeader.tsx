import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {TimeSince} from 'sentry/components/timeSince';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {SeerExplorerDebugMenu} from 'sentry/views/seerExplorer/components/seerExplorerDebugMenu';
import {
  SeerExplorerHeaderActions,
  SeerExplorerHeaderActionsMenu,
} from 'sentry/views/seerExplorer/components/seerExplorerHeaderActions';
import {useSeerExplorerSessionsQuery} from 'sentry/views/seerExplorer/seerExplorerSessionContext';
import type {
  SeerExplorerRunId,
  SeerExplorerSidebarPosition,
} from 'sentry/views/seerExplorer/types';

/**
 * The shared inner header content (title + action cluster) for Seer Explorer.
 * Returns a fragment — the surface (drawer / sidebar) provides the outer
 * `<header>` wrapper and the close affordance via a slot.
 *
 * The action cluster reshapes across three sizes of its nearest query container
 * (the Seer content pane): large shows everything expanded, medium (`≤ 500px`)
 * drops text labels, and small (`≤ 380px`) folds the middle actions into an
 * overflow menu.
 */
interface SeerExplorerHeaderProps {
  isPipSupported: boolean;
  isPoppedOut: boolean;
  onChangeSession: (runId: SeerExplorerRunId) => void;
  onCopyLinkClick: (() => void) | undefined;
  onCopySessionClick: (() => void) | undefined;
  onNewChatClick: () => void;
  onOverrideCtxEngEnableToggle: () => void;
  onShowThinkingToggle: () => void;
  onTogglePictureInPicture: () => void;
  overrideCtxEngEnable: boolean;
  showThinking: boolean;
  disableNewChatButton?: boolean;
  onSidebarPositionChange?: (position: SeerExplorerSidebarPosition) => void;
  sidebarPosition?: SeerExplorerSidebarPosition;
}

export function SeerExplorerHeader({
  onNewChatClick,
  onChangeSession,
  onCopySessionClick,
  onCopyLinkClick,
  overrideCtxEngEnable,
  onOverrideCtxEngEnableToggle,
  showThinking,
  onShowThinkingToggle,
  isPipSupported,
  isPoppedOut,
  onTogglePictureInPicture,
  sidebarPosition = 'auto',
  onSidebarPositionChange,
  disableNewChatButton = false,
}: SeerExplorerHeaderProps) {
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
      data?.map(session => ({
        value: session.id,
        label: session.title ?? t('Untitled chat'),
        details: (
          <TimeSince
            tooltipPrefix="Last updated"
            date={moment.utc(session.lastTriggeredAt).toDate()}
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

  const actionsProps = {
    onChangeSession,
    onCopyLinkClick,
    onCopySessionClick,
    onHistoryOpenChange,
    onSearchChange: setSearch,
    onTogglePictureInPicture,
    isPipSupported,
    isPoppedOut,
    sidebarPosition,
    onSidebarPositionChange,
    sessionOptions,
    sessionsLoading: isFetching || isSearchPending,
    sessionsError: isError,
  };

  return (
    <Fragment>
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
      <Flex gap="sm" align="center">
        <SeerExplorerDebugMenu
          overrideCtxEngEnable={overrideCtxEngEnable}
          onOverrideCtxEngEnableToggle={onOverrideCtxEngEnableToggle}
          showThinking={showThinking}
          onShowThinkingToggle={onShowThinkingToggle}
        />
        <InlineActions>
          <SeerExplorerHeaderActions {...actionsProps} />
        </InlineActions>
        <OverflowActions>
          <SeerExplorerHeaderActionsMenu {...actionsProps} />
        </OverflowActions>
        <Container display={{'2xs': 'none', xs: 'contents'}}>
          <Button
            icon={<IconAdd />}
            onClick={onNewChatClick}
            disabled={disableNewChatButton}
            variant="secondary"
            size="xs"
            tooltipProps={{title: t('Start a new chat (/new)')}}
          >
            {t('New chat')}
          </Button>
        </Container>
        <Container display={{'2xs': 'contents', xs: 'none'}}>
          <Button
            icon={<IconAdd />}
            onClick={onNewChatClick}
            disabled={disableNewChatButton}
            variant="secondary"
            size="xs"
            aria-label={t('Start a new chat (/new)')}
            tooltipProps={{title: t('Start a new chat (/new)')}}
          />
        </Container>
      </Flex>
    </Fragment>
  );
}

const InlineActions = styled(Flex)`
  align-items: center;

  @container (max-width: 380px) {
    display: none;
  }
`;

const OverflowActions = styled('div')`
  display: none;

  @container (max-width: 380px) {
    display: block;
  }
`;
