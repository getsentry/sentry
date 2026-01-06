import type {ReactNode} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';
import invariant from 'invariant';
import {PlatformIcon} from 'platformicons';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Checkbox} from 'sentry/components/core/checkbox';
import {Flex} from 'sentry/components/core/layout/flex';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import Duration from 'sentry/components/duration/duration';
import {useSelectedReplayIndex} from 'sentry/components/replays/queryParams/selectedReplayIndex';
import ReplayBadge from 'sentry/components/replays/replayBadge';
import ReplayPlayPauseButton from 'sentry/components/replays/replayPlayPauseButton';
import NumericDropdownFilter from 'sentry/components/replays/table/filters/numericDropdownFilter';
import OSBrowserDropdownFilter from 'sentry/components/replays/table/filters/osBrowserDropdownFilter';
import ScoreBar from 'sentry/components/scoreBar';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconNot} from 'sentry/icons';
import {IconCursorArrow} from 'sentry/icons/iconCursorArrow';
import {IconFire} from 'sentry/icons/iconFire';
import {IconOpen} from 'sentry/icons/iconOpen';
import {IconPlay} from 'sentry/icons/iconPlay';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {spanOperationRelativeBreakdownRenderer} from 'sentry/utils/discover/fieldRenderers';
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
  to: string | LocationDescriptor;
  className?: string;
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
            <Flex justify="center" width="20px">
              <IconNot size="xs" variant="muted" />
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
      isHoverable
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
      isHoverable
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
              <IconFire variant="danger" />
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
      isHoverable
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
              <IconCursorArrow size="sm" variant="danger" />
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
  Component: ({to}) => {
    return (
      <DetailsLink to={to}>
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
    const {isSelected, toggleSelected} = useListItemCheckboxContext();
    if (replay.is_archived) {
      return null;
    }
    return (
      <CheckboxClickCapture onClick={e => e.stopPropagation()}>
        <CheckboxCellContainer>
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
  Component: ({replay, to, className}) => {
    const routes = useRoutes();
    const referrer = getRouteStringFromRoutes(routes);

    const organization = useOrganization();
    const project = useProjectFromId({project_id: replay.project_id ?? undefined});

    if (replay.is_archived) {
      return <ReplayBadge replay={replay} />;
    }

    invariant(
      replay.started_at,
      'For TypeScript: replay.started_at is implied because replay.is_archived is false'
    );

    const trackNavigationEvent = () =>
      trackAnalytics('replay.list-navigate-to-details', {
        project_id: project?.id,
        platform: project?.platform,
        organization,
        referrer,
        referrer_table: 'main',
      });

    return (
      <CellLink className={className} to={to} onClick={trackNavigationEvent}>
        <ReplayBadge replay={replay} />
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

const TabularNumber = styled('div')`
  font-variant-numeric: tabular-nums;
`;

const CellLink = styled(Link)`
  ${SimpleTable.rowLinkStyle}

  flex-grow: 1;
`;

const PlayPauseButtonContainer = styled(Flex)`
  ${SimpleTable.rowLinkStyle}

  z-index: 1; /* Raise above any ReplaySessionColumn in the row */
  flex-direction: column;
  justify-content: center;
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

  background-color: ${p => p.theme.colors.blue500};
  &[data-has-viewed='true'] {
    background-color: transparent;
  }
`;

const SpanOperationBreakdown = styled('div')`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  color: ${p => p.theme.colors.gray800};
  font-size: ${p => p.theme.fontSize.md};
  text-align: right;
`;
