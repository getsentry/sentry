import type {ReactNode} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import invariant from 'invariant';
import {PlatformIcon} from 'platformicons';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Checkbox} from 'sentry/components/core/checkbox';
import {Flex} from 'sentry/components/core/layout/flex';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import Duration from 'sentry/components/duration/duration';
import {useSelectedReplayIndex} from 'sentry/components/replays/queryParams/selectedReplayIndex';
import ReplayPlayPauseButton from 'sentry/components/replays/replayPlayPauseButton';
import NumericDropdownFilter from 'sentry/components/replays/table/filters/numericDropdownFilter';
import OSBrowserDropdownFilter from 'sentry/components/replays/table/filters/osBrowserDropdownFilter';
import ScoreBar from 'sentry/components/scoreBar';
import TimeSince from 'sentry/components/timeSince';
import {IconNot} from 'sentry/icons';
import {IconCalendar} from 'sentry/icons/iconCalendar';
import {IconCursorArrow} from 'sentry/icons/iconCursorArrow';
import {IconDelete} from 'sentry/icons/iconDelete';
import {IconFire} from 'sentry/icons/iconFire';
import {IconOpen} from 'sentry/icons/iconOpen';
import {IconPlay} from 'sentry/icons/iconPlay';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {spanOperationRelativeBreakdownRenderer} from 'sentry/utils/discover/fieldRenderers';
import {getShortEventId} from 'sentry/utils/events';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import {generatePlatformIconName} from 'sentry/utils/replays/generatePlatformIconName';
import {MIN_DEAD_RAGE_CLICK_SDK} from 'sentry/utils/replays/sdkVersions';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {useRoutes} from 'sentry/utils/useRoutes';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysWithTxData';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';
import type {
  ReplayListRecord,
  ReplayRecordNestedFieldName,
} from 'sentry/views/replays/types';

type ListRecord = ReplayListRecord | ReplayListRecordWithTx;

interface HeaderProps {
  columnIndex: number;
  listItemCheckboxState: ReturnType<typeof useListItemCheckboxContext>;
  replays: ReplayListRecord[];
}

interface CellProps {
  columnIndex: number;
  replay: ListRecord;
  rowIndex: number;
  showDropdownFilters: boolean;
}

export interface ReplayTableColumn {
  /**
   * Render the content
   * Content will be automatically wrapped with `<SimpleTable.RowCell>`
   */
  Component: (props: CellProps) => ReactNode;

  /**
   * Render the header
   * Header will be automatically wrapped with `<SimpleTable.HeaderCell>`
   */
  Header: string | ((props: HeaderProps) => ReactNode);

  /**
   * If any columns in the table are interactive, we will add an
   * `<InteractionStateLayer>` to each row.
   */
  interactive: boolean;

  /**
   * The `ReplayListRecord` key to sort by
   * If `undefined`, the column header will not be clickable.
   */
  sortKey: undefined | ReplayRecordNestedFieldName;

  /**
   * The width of the column
   * Defaults to `max-content`
   */
  width?: string;
}

export const ReplayActivityColumn: ReplayTableColumn = {
  Header: () => (
    <Tooltip
      title={t(
        'Activity represents how much user activity happened in a replay. It is determined by the number of errors encountered, duration, and UI events.'
      )}
    >
      {t('Activity')}
    </Tooltip>
  ),
  interactive: false,
  sortKey: 'activity',
  Component: ({replay, showDropdownFilters}) => {
    const theme = useTheme();

    if (replay.is_archived) {
      return null;
    }
    const colors = theme.chart.getColorPalette(0);
    const scoreBarPalette = new Array(10).fill([colors[0]]);
    return (
      <DropdownContainer key="activity">
        <ScoreBar
          size={20}
          score={replay?.activity ?? 1}
          palette={scoreBarPalette}
          radius={0}
        />
        {showDropdownFilters ? (
          <NumericDropdownFilter type="activity" val={replay?.activity ?? 0} />
        ) : null}
      </DropdownContainer>
    );
  },
};

export const ReplayBrowserColumn: ReplayTableColumn = {
  Header: t('Browser'),
  interactive: false,
  sortKey: 'browser.name',
  Component: ({replay, showDropdownFilters}) => {
    const theme = useTheme();
    const isLargeBreakpoint = useMedia(`(min-width: ${theme.breakpoints.lg})`);

    if (replay.is_archived) {
      return null;
    }
    const {name, version} = replay.browser;
    if (!name && !version) {
      return (
        <DropdownContainer>
          <Tooltip title={t('N/A')}>
            <Flex justify="center" style={{width: '20px'}}>
              <IconNot size="xs" color="gray300" />
            </Flex>
          </Tooltip>
        </DropdownContainer>
      );
    }

    const icon = generatePlatformIconName(
      name ?? '',
      version && isLargeBreakpoint ? version : undefined
    );

    const nameOrUnknown = name ?? t('Unknown');
    const versionOrBlank = version ?? '';

    return (
      <DropdownContainer key="browser">
        <Tooltip title={`${nameOrUnknown} ${versionOrBlank}`.trim()}>
          <PlatformIcon platform={icon} size="20px" />
          {showDropdownFilters ? (
            <OSBrowserDropdownFilter type="browser" name={name} version={version} />
          ) : null}
        </Tooltip>
      </DropdownContainer>
    );
  },
};

export const ReplayCountDeadClicksColumn: ReplayTableColumn = {
  Header: () => (
    <Tooltip
      title={tct(
        'A dead click is a user click that does not result in any page activity after 7 seconds. Requires SDK version >= [minSDK]. [link:Learn more.]',
        {
          minSDK: MIN_DEAD_RAGE_CLICK_SDK.minVersion,
          link: <ExternalLink href="https://docs.sentry.io/platforms/javascript/" />,
        }
      )}
    >
      {t('Dead clicks')}
    </Tooltip>
  ),
  interactive: false,
  sortKey: 'count_dead_clicks',
  Component: ({replay, showDropdownFilters}) => {
    if (replay.is_archived) {
      return null;
    }
    return (
      <DropdownContainer key="countDeadClicks">
        <TabularNumber>
          {replay.count_dead_clicks ? (
            <Flex gap="xs">
              <IconCursorArrow size="sm" color="yellow300" />
              {replay.count_dead_clicks}
            </Flex>
          ) : (
            0
          )}
        </TabularNumber>
        {showDropdownFilters ? (
          <NumericDropdownFilter
            type="count_dead_clicks"
            val={replay.count_dead_clicks ?? 0}
          />
        ) : null}
      </DropdownContainer>
    );
  },
};

export const ReplayCountErrorsColumn: ReplayTableColumn = {
  Header: () => (
    <Tooltip
      title={tct(
        'The error count only reflects errors generated within the Replay SDK. [inboundFilters:Inbound Filters] may have prevented those errors from being saved. [perfIssue:Performance] and other [replayIssue:error] types may have been added afterwards.',
        {
          inboundFilters: (
            <ExternalLink href="https://docs.sentry.io/concepts/data-management/filtering/" />
          ),
          replayIssue: (
            <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/replay-issues/" />
          ),
          perfIssue: (
            <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/performance-issues/" />
          ),
        }
      )}
    >
      {t('Errors')}
    </Tooltip>
  ),
  interactive: false,
  sortKey: 'count_errors',
  Component: ({replay, showDropdownFilters}) => {
    if (replay.is_archived) {
      return null;
    }
    return (
      <DropdownContainer
        key="countErrors"
        data-test-id="replay-table-column-count-errors"
      >
        <TabularNumber>
          {replay.count_errors ? (
            <Flex gap="xs">
              <IconFire color="red300" />
              {replay.count_errors}
            </Flex>
          ) : (
            0
          )}
        </TabularNumber>
        {showDropdownFilters ? (
          <NumericDropdownFilter type="count_errors" val={replay.count_errors ?? 0} />
        ) : null}
      </DropdownContainer>
    );
  },
};

export const ReplayCountRageClicksColumn: ReplayTableColumn = {
  Header: () => (
    <Tooltip
      title={tct(
        'A rage click is 5 or more clicks on a dead element, which exhibits no page activity after 7 seconds. Requires SDK version >= [minSDK]. [link:Learn more.]',
        {
          minSDK: MIN_DEAD_RAGE_CLICK_SDK.minVersion,
          link: <ExternalLink href="https://docs.sentry.io/platforms/javascript/" />,
        }
      )}
    >
      {t('Rage clicks')}
    </Tooltip>
  ),
  interactive: false,
  sortKey: 'count_rage_clicks',
  Component: ({replay, showDropdownFilters}) => {
    if (replay.is_archived) {
      return null;
    }
    return (
      <DropdownContainer key="countRageClicks">
        <TabularNumber>
          {replay.count_rage_clicks ? (
            <Flex gap="xs">
              <IconCursorArrow size="sm" color="red300" />
              {replay.count_rage_clicks}
            </Flex>
          ) : (
            0
          )}
        </TabularNumber>
        {showDropdownFilters ? (
          <NumericDropdownFilter
            type="count_rage_clicks"
            val={replay.count_rage_clicks ?? 0}
          />
        ) : null}
      </DropdownContainer>
    );
  },
};

export const ReplayDetailsLinkColumn: ReplayTableColumn = {
  Header: '',
  interactive: true,
  sortKey: undefined,
  Component: ({replay}) => {
    const organization = useOrganization();
    return (
      <DetailsLink to={makeReplaysPathname({path: `/${replay.id}/`, organization})}>
        <Tooltip title={t('See Full Replay')}>
          <IconOpen />
        </Tooltip>
      </DetailsLink>
    );
  },
};

export const ReplayDurationColumn: ReplayTableColumn = {
  Header: t('Duration'),
  interactive: false,
  sortKey: 'duration',
  Component: ({replay, showDropdownFilters}) => {
    if (replay.is_archived) {
      return null;
    }
    invariant(
      replay.duration,
      'For TypeScript: replay.duration is implied because replay.is_archived is false'
    );
    return (
      <DropdownContainer key="duration">
        <Duration duration={[replay.duration.asMilliseconds(), 'ms']} precision="sec" />
        {showDropdownFilters ? (
          <NumericDropdownFilter
            type="duration"
            val={replay.duration.asSeconds() ?? 0}
            formatter={(val: number) => `${val}s`}
          />
        ) : null}
      </DropdownContainer>
    );
  },
};

export const ReplayOSColumn: ReplayTableColumn = {
  Header: t('OS'),
  interactive: false,
  sortKey: 'os.name',
  Component: ({replay, showDropdownFilters}) => {
    const theme = useTheme();
    const isLargeBreakpoint = useMedia(`(min-width: ${theme.breakpoints.lg})`);

    if (replay.is_archived) {
      return null;
    }
    const {name, version} = replay.os;
    const icon = generatePlatformIconName(
      name ?? '',
      version && isLargeBreakpoint ? version : undefined
    );

    const nameOrUnknown = name ?? t('Unknown');
    const versionOrBlank = version ?? '';

    return (
      <DropdownContainer key="os">
        <Tooltip title={`${nameOrUnknown} ${versionOrBlank}`.trim()}>
          <PlatformIcon platform={icon} size="20px" />
          {showDropdownFilters ? (
            <OSBrowserDropdownFilter type="os" name={name} version={version} />
          ) : null}
        </Tooltip>
      </DropdownContainer>
    );
  },
};

export const ReplayPlayPauseColumn: ReplayTableColumn = {
  Header: '',
  interactive: true,
  sortKey: undefined,
  Component: ({replay, rowIndex}) => {
    const location = useLocation();
    const {index: selectedReplayIndex, select: setSelectedReplayIndex} =
      useSelectedReplayIndex();

    if (replay.is_archived) {
      return null;
    }
    if (rowIndex === selectedReplayIndex) {
      return (
        <PlayPauseButtonContainer>
          <ReplayPlayPauseButton
            key="playPause-play"
            borderless
            priority="default"
            size="sm"
          />
        </PlayPauseButtonContainer>
      );
    }
    return (
      <PlayPauseButtonContainer onClick={() => setSelectedReplayIndex(rowIndex)}>
        <LinkButton
          key="playPause-select"
          aria-label={t('Play')}
          borderless
          data-test-id="replay-table-play-button"
          icon={<IconPlay />}
          to={{
            pathname: location.pathname,
            query: {...location.query, selected_replay_index: rowIndex},
          }}
          priority="default"
          size="sm"
          title={t('Play')}
        />
      </PlayPauseButtonContainer>
    );
  },
};

export const ReplaySelectColumn: ReplayTableColumn = {
  Header: ({
    listItemCheckboxState: {
      deselectAll,
      isAllSelected,
      knownIds,
      selectedIds,
      toggleSelected,
    },
    replays,
  }) => {
    const organization = useOrganization();
    if (!organization.features.includes('replay-list-select')) {
      return null;
    }
    return (
      <CheckboxHeaderContainer>
        <Checkbox
          id="replay-table-select-all"
          checked={isAllSelected}
          disabled={knownIds.length === 0}
          onChange={() => {
            // If the replay is archived, don't include it in the selection
            const eligibleIds = knownIds.filter(
              id => !replays.find(r => r.id === id)?.is_archived
            );

            if (isAllSelected === true || selectedIds.length === eligibleIds.length) {
              deselectAll();
            } else {
              // Make everything visible selected
              const unselectedIds = eligibleIds.filter(id => !selectedIds.includes(id));
              toggleSelected(unselectedIds);
            }
          }}
        />
      </CheckboxHeaderContainer>
    );
  },
  interactive: true,
  sortKey: undefined,
  Component: ({replay}) => {
    const organization = useOrganization();
    const {isSelected, toggleSelected} = useListItemCheckboxContext();
    if (replay.is_archived) {
      return null;
    }
    return (
      <CheckboxClickCapture onClick={e => e.stopPropagation()}>
        <CheckboxCellContainer>
          {organization.features.includes('replay-list-select') ? (
            <CheckboxClickTarget htmlFor={`replay-table-select-${replay.id}`}>
              <Checkbox
                id={`replay-table-select-${replay.id}`}
                disabled={isSelected(replay.id) === 'all-selected'}
                checked={isSelected(replay.id) !== false}
                onChange={() => {
                  toggleSelected(replay.id);
                }}
              />
            </CheckboxClickTarget>
          ) : null}

          <Tooltip title={t('Unread')} skipWrapper disabled={Boolean(replay.has_viewed)}>
            <UnreadIndicator data-has-viewed={replay.has_viewed} />
          </Tooltip>
        </CheckboxCellContainer>
      </CheckboxClickCapture>
    );
  },
};

export const ReplaySessionColumn: ReplayTableColumn = {
  Header: () => (
    <Tooltip title={t('By default, replays are sorted by time sent.')}>
      {t('Replay')}
    </Tooltip>
  ),
  interactive: true,
  sortKey: 'started_at',
  width: 'minmax(150px, 1fr)',
  Component: ({replay}) => {
    const routes = useRoutes();
    const location = useLocation();
    const organization = useOrganization();
    const analyticsArea = useAnalyticsArea();
    const project = useProjectFromId({project_id: replay.project_id ?? undefined});

    const isSelectorWidget = analyticsArea.endsWith('example-replays-list');

    if (replay.is_archived) {
      return (
        <Flex gap="md" align="center" justify="center">
          <ArchivedWrapper>
            <IconDelete color="gray500" size="md" />
          </ArchivedWrapper>

          <Flex direction="column" gap="xs">
            <DisplayName>{t('Deleted Replay')}</DisplayName>
            <Flex gap="xs" align="center">
              {project ? <ProjectAvatar size={12} project={project} /> : null}
              <SmallFont>{getShortEventId(replay.id)}</SmallFont>
            </Flex>
          </Flex>
        </Flex>
      );
    }

    invariant(
      replay.started_at,
      'For TypeScript: replay.started_at is implied because replay.is_archived is false'
    );

    const referrer = getRouteStringFromRoutes(routes);
    const eventView = EventView.fromLocation(location);
    const replayDetailsPathname = makeReplaysPathname({
      path: `/${replay.id}/`,
      organization,
    });

    const detailsTab = () => ({
      pathname: replayDetailsPathname,
      query: {
        referrer,
        ...eventView.generateQueryStringObject(),
        f_b_type: isSelectorWidget ? 'rageOrDead' : undefined,
      },
    });
    const trackNavigationEvent = () =>
      trackAnalytics('replay.list-navigate-to-details', {
        project_id: project?.id,
        platform: project?.platform,
        organization,
        referrer,
        referrer_table: isSelectorWidget ? 'selector-widget' : 'main',
      });

    return (
      <CellLink to={detailsTab()} onClick={trackNavigationEvent}>
        <Flex key="session" align="center" gap="md">
          <UserAvatar
            user={{
              username: replay.user?.display_name || '',
              email: replay.user?.email || '',
              id: replay.user?.id || '',
              ip_address: replay.user?.ip || '',
              name: replay.user?.username || '',
            }}
            size={24}
          />
          <SubText>
            <Flex gap="xs" align="start">
              <DisplayName data-underline-on-hover>
                {replay.user.display_name || t('Anonymous User')}
              </DisplayName>
            </Flex>
            <Flex gap="xs">
              {/* Avatar is used instead of ProjectBadge because using ProjectBadge increases spacing, which doesn't look as good */}
              {project ? <ProjectAvatar size={12} project={project} /> : null}
              {project ? <span>{project.slug}</span> : null}
              <span>{getShortEventId(replay.id)}</span>
              <Flex gap="xs">
                <IconCalendar color="gray300" size="xs" />
                <TimeSince date={replay.started_at} />
              </Flex>
            </Flex>
          </SubText>
        </Flex>
      </CellLink>
    );
  },
};

export const ReplaySlowestTransactionColumn: ReplayTableColumn = {
  Header: t('Slowest Transaction'),
  interactive: false,
  sortKey: undefined,
  Component: ({replay}) => {
    const location = useLocation();
    const organization = useOrganization();
    const theme = useTheme();

    if (replay.is_archived) {
      return null;
    }
    const hasTxEvent = 'txEvent' in replay;
    const txDuration = hasTxEvent ? replay.txEvent?.['transaction.duration'] : undefined;
    if (!hasTxEvent) {
      return null;
    }
    return (
      <SpanOperationBreakdown key="slowestTransaction">
        {txDuration ? <div>{txDuration}ms</div> : null}
        {spanOperationRelativeBreakdownRenderer(
          replay.txEvent,
          {organization, location, theme},
          {enableOnClick: false}
        )}
      </SpanOperationBreakdown>
    );
  },
};

const ArchivedWrapper = styled(Flex)`
  width: ${p => p.theme.space['2xl']};
  align-items: center;
  justify-content: center;
`;

const DetailsLink = styled(Link)`
  z-index: 1;
  margin: -${p => p.theme.space.md};
  padding: ${p => p.theme.space.md};
  line-height: 0;
`;

const DropdownContainer = styled(Flex)`
  position: relative;
  flex-direction: column;
  justify-content: center;
`;

const SmallFont = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
`;

const TabularNumber = styled('div')`
  font-variant-numeric: tabular-nums;
`;

const CellLink = styled(Link)`
  margin: -${p => p.theme.space.xl};
  padding: ${p => p.theme.space.xl};
  flex-grow: 1;

  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
`;

const SubText = styled('div')`
  font-size: 0.875em;
  line-height: normal;
  color: ${p => p.theme.subText};
  ${p => p.theme.overflowEllipsis};
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
  align-items: flex-start;
`;

const DisplayName = styled('span')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  line-height: normal;
  ${p => p.theme.overflowEllipsis};

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

const PlayPauseButtonContainer = styled(Flex)`
  z-index: 1; /* Raise above any ReplaySessionColumn in the row */
  display: flex;
  flex-direction: column;
  justify-content: center;

  margin: 0 -${space(2)} 0 -${space(1)};

  cursor: pointer;
  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
`;

const CheckboxHeaderContainer = styled(Flex)`
  display: flex;
  position: relative;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: ${space(1)};

  margin: 0 -${space(1)} 0 -${space(0.5)};
`;

const CheckboxClickCapture = styled('div')`
  z-index: 1; /* Raise above any ReplaySessionColumn in the row */
  padding: ${space(2)};
  margin: -${space(2)};
`;

const CheckboxCellContainer = styled('div')`
  display: flex;
  position: relative;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: ${space(0.5)};

  padding: ${space(0.5)} 0 0 0;
  margin: 0 -${space(1)} 0 -${space(0.5)};
`;

const CheckboxClickTarget = styled('label')`
  cursor: pointer;
  display: block;
  margin: -${p => p.theme.space.md};
  padding: ${p => p.theme.space.md};
  max-width: unset;
  line-height: 0;
`;

const UnreadIndicator = styled('div')`
  width: 8px;
  height: 8px;
  border-radius: 50%;

  background-color: ${p => p.theme.purple400};
  &[data-has-viewed='true'] {
    background-color: transparent;
  }
`;

const SpanOperationBreakdown = styled('div')`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.fontSize.md};
  text-align: right;
`;
