import type {ReactNode} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import invariant from 'invariant';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout/flex';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import Duration from 'sentry/components/duration/duration';
import ExternalLink from 'sentry/components/links/externalLink';
import {useSelectedReplayIndex} from 'sentry/components/replays/queryParams/selectedReplayIndex';
import ReplayPlatformIcon from 'sentry/components/replays/replayPlatformIcon';
import ReplayPlayPauseButton from 'sentry/components/replays/replayPlayPauseButton';
import NumericDropdownFilter from 'sentry/components/replays/table/filters/numericDropdownFilter';
import OSBrowserDropdownFilter from 'sentry/components/replays/table/filters/osBrowserDropdownFilter';
import ScoreBar from 'sentry/components/scoreBar';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar} from 'sentry/icons/iconCalendar';
import {IconCursorArrow} from 'sentry/icons/iconCursorArrow';
import {IconDelete} from 'sentry/icons/iconDelete';
import {IconFire} from 'sentry/icons/iconFire';
import {IconNot} from 'sentry/icons/iconNot';
import {IconPlay} from 'sentry/icons/iconPlay';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {spanOperationRelativeBreakdownRenderer} from 'sentry/utils/discover/fieldRenderers';
import {getShortEventId} from 'sentry/utils/events';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
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

interface RenderProps {
  columnIndex: number;
  replay: ListRecord;
  rowIndex: number;
  showDropdownFilters: boolean;
}

export interface ReplayTableColumn {
  Component: (props: RenderProps) => ReactNode;
  name: string;
  sortKey: undefined | ReplayRecordNestedFieldName;
  tooltip?: ReactNode;
}

export const ReplayActivityColumn: ReplayTableColumn = {
  name: t('Activity'),
  tooltip: t(
    'Activity represents how much user activity happened in a replay. It is determined by the number of errors encountered, duration, and UI events.'
  ),
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
  name: t('Browser'),
  sortKey: 'browser.name',
  Component: ({replay, showDropdownFilters}) => {
    const theme = useTheme();
    const isLargeBreakpoint = useMedia(`(min-width: ${theme.breakpoints.lg})`);

    if (replay.is_archived) {
      return null;
    }
    const {name, version} = replay.browser;
    if (name === null && version === null) {
      return <IconNot size="xs" color="gray300" />;
    }

    return (
      <DropdownContainer key="browser">
        <Tooltip title={`${name} ${version}`}>
          <ReplayPlatformIcon
            name={name ?? ''}
            version={version && isLargeBreakpoint ? version : undefined}
            showVersion={false}
            showTooltip={false}
          />
          {showDropdownFilters ? (
            <OSBrowserDropdownFilter type="browser" name={name} version={version} />
          ) : null}
        </Tooltip>
      </DropdownContainer>
    );
  },
};

export const ReplayCountDeadClicksColumn: ReplayTableColumn = {
  name: t('Dead clicks'),
  tooltip: tct(
    'A dead click is a user click that does not result in any page activity after 7 seconds. Requires SDK version >= [minSDK]. [link:Learn more.]',
    {
      minSDK: MIN_DEAD_RAGE_CLICK_SDK.minVersion,
      link: <ExternalLink href="https://docs.sentry.io/platforms/javascript/" />,
    }
  ),
  sortKey: 'count_dead_clicks',
  Component: ({replay, showDropdownFilters}) => {
    if (replay.is_archived) {
      return null;
    }
    return (
      <DropdownContainer key="countDeadClicks">
        <TabularNumber>
          {replay.count_dead_clicks ? (
            <Flex gap={space(0.5)}>
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
  name: t('Errors'),
  tooltip: tct(
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
  ),
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
            <Flex gap={space(0.5)}>
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
  name: t('Rage clicks'),
  tooltip: tct(
    'A rage click is 5 or more clicks on a dead element, which exhibits no page activity after 7 seconds. Requires SDK version >= [minSDK]. [link:Learn more.]',
    {
      minSDK: MIN_DEAD_RAGE_CLICK_SDK.minVersion,
      link: <ExternalLink href="https://docs.sentry.io/platforms/javascript/" />,
    }
  ),
  sortKey: 'count_rage_clicks',
  Component: ({replay, showDropdownFilters}) => {
    if (replay.is_archived) {
      return null;
    }
    return (
      <DropdownContainer key="countRageClicks">
        <TabularNumber>
          {replay.count_rage_clicks ? (
            <Flex gap={space(0.5)}>
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

export const ReplayDurationColumn: ReplayTableColumn = {
  name: t('Duration'),
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
  name: t('OS'),
  sortKey: 'os.name',
  Component: ({replay, showDropdownFilters}) => {
    const theme = useTheme();
    const isLargeBreakpoint = useMedia(`(min-width: ${theme.breakpoints.lg})`);

    if (replay.is_archived) {
      return null;
    }
    const {name, version} = replay.os;
    return (
      <DropdownContainer key="os">
        <Tooltip title={`${name ?? ''} ${version ?? ''}`}>
          <ReplayPlatformIcon
            name={name ?? ''}
            version={version && isLargeBreakpoint ? version : undefined}
            showVersion={false}
            showTooltip={false}
          />
          {showDropdownFilters ? (
            <OSBrowserDropdownFilter type="os" name={name} version={version} />
          ) : null}
        </Tooltip>
      </DropdownContainer>
    );
  },
};

export const ReplayPlayPauseColumn: ReplayTableColumn = {
  name: '',
  sortKey: undefined,
  Component: ({replay, rowIndex}) => {
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
      <PlayPauseButtonContainer>
        <Button
          key="playPause-select" redesign
          aria-label={t('Play')}
          borderless
          data-test-id="replay-table-play-button"
          icon={<IconPlay redesign />}
          onClick={() => setSelectedReplayIndex(rowIndex)}
          priority="default"
          size="sm"
          title={t('Play')}
        />
      </PlayPauseButtonContainer>
    );
  },
};

export const ReplaySessionColumn: ReplayTableColumn = {
  name: t('Replay'),
  sortKey: 'started_at',
  Component: ({replay}) => {
    const routes = useRoutes();
    const location = useLocation();
    const organization = useOrganization();
    const analyticsArea = useAnalyticsArea();
    const project = useProjectFromId({project_id: replay.project_id ?? undefined});

    // TODO(ryan953): This is a janky way to detect the current page.
    const isIssuesReplayList = location.pathname.includes('issues');
    const isSelectorWidget = analyticsArea.endsWith('example-replays-list');

    if (replay.is_archived) {
      return (
        <Flex gap={space(1)} align="center" justify="center">
          <div style={{paddingInline: space(0.5)}}>
            <IconDelete color="gray500" size="md" />
          </div>

          <Flex direction="column" gap={space(0.5)}>
            <Flex gap={space(0.5)} align="center">
              {t('Deleted Replay')}
            </Flex>
            <Flex gap={space(0.5)} align="center">
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
      <Flex key="session" align="center" gap={space(1)}>
        <UserAvatar user={getUserBadgeUser(replay)} size={24} />
        <SubText>
          <Flex gap={space(0.5)} align="flex-start">
            <DisplayNameLink
              to={
                isIssuesReplayList
                  ? // if on the issues replay list, don't redirect to the details tab. this causes URL flickering
                    {
                      pathname: location.pathname,
                      query: location.query,
                    }
                  : detailsTab()
              }
              onClick={trackNavigationEvent}
              data-has-viewed={replay.has_viewed}
            >
              {replay.user.display_name || t('Anonymous User')}
            </DisplayNameLink>
          </Flex>
          <Flex gap={space(0.5)}>
            {/* Avatar is used instead of ProjectBadge because using ProjectBadge increases spacing, which doesn't look as good */}
            {project ? <ProjectAvatar size={12} project={project} /> : null}
            {project ? project.slug : null}
            <Link to={detailsTab()} onClick={trackNavigationEvent}>
              {getShortEventId(replay.id)}
            </Link>
            <Flex gap={space(0.5)}>
              <IconCalendar color="gray300" size="xs" />
              <TimeSince date={replay.started_at} />
            </Flex>
          </Flex>
        </SubText>
      </Flex>
    );
  },
};

export const ReplaySlowestTransactionColumn: ReplayTableColumn = {
  name: t('Slowest Transaction'),
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

function getUserBadgeUser(replay: ListRecord) {
  return replay.is_archived
    ? {
        username: '',
        email: '',
        id: '',
        ip_address: '',
        name: '',
      }
    : {
        username: replay.user?.display_name || '',
        email: replay.user?.email || '',
        id: replay.user?.id || '',
        ip_address: replay.user?.ip || '',
        name: replay.user?.username || '',
      };
}

const DropdownContainer = styled(Flex)`
  flex-direction: column;
  justify-content: center;
`;

const SmallFont = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
`;

const TabularNumber = styled('div')`
  font-variant-numeric: tabular-nums;
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

const DisplayNameLink = styled(Link)`
  font-size: ${p => p.theme.fontSize.lg};
  line-height: normal;
  ${p => p.theme.overflowEllipsis};

  font-weight: ${p => p.theme.fontWeight.bold};
  &[data-has-viewed='true'] {
    font-weight: ${p => p.theme.fontWeight.normal};
  }
`;

const PlayPauseButtonContainer = styled(Flex)`
  position: relative;
  flex-direction: column;
  justify-content: center;

  margin: 0 -${space(2)} 0 -${space(1)};
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
