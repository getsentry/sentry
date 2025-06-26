import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import invariant from 'invariant';

import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import Duration from 'sentry/components/duration/duration';
import Link from 'sentry/components/links/link';
import {useSelectedReplayIndex} from 'sentry/components/replays/queryParams/selectedReplayIndex';
import ReplayPlatformIcon from 'sentry/components/replays/replayPlatformIcon';
import ReplayPlayPauseButton from 'sentry/components/replays/replayPlayPauseButton';
import ScoreBar from 'sentry/components/scoreBar';
import TimeSince from 'sentry/components/timeSince';
import {
  IconCalendar,
  IconCursorArrow,
  IconDelete,
  IconEllipsis,
  IconFire,
  IconNot,
  IconPlay,
} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {ValidSize} from 'sentry/styles/space';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import {spanOperationRelativeBreakdownRenderer} from 'sentry/utils/discover/fieldRenderers';
import {getShortEventId} from 'sentry/utils/events';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysWithTxData';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';
import type {ReplayListLocationQuery, ReplayListRecord} from 'sentry/views/replays/types';

type Props = {
  replay: ReplayListRecord | ReplayListRecordWithTx;
  rowIndex: number;
  showDropdownFilters?: boolean;
};

export type ReferrerTableType = 'main' | 'selector-widget';

type EditType = 'set' | 'remove';

function generateAction({
  key,
  value,
  edit,
  location,
  navigate,
}: {
  edit: EditType;
  key: string;
  location: Location<ReplayListLocationQuery>;
  navigate: ReturnType<typeof useNavigate>;
  value: string;
}) {
  const search = new MutableSearch(decodeScalar(location.query.query) || '');

  const modifiedQuery =
    edit === 'set' ? search.setFilterValues(key, [value]) : search.removeFilter(key);

  const onAction = () => {
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        query: modifiedQuery.formatString(),
      },
    });
  };

  return onAction;
}

function OSBrowserDropdownFilter({
  type,
  name,
  version,
}: {
  name: string | null;
  type: string;
  version: string | null;
}) {
  const location = useLocation<ReplayListLocationQuery>();
  const navigate = useNavigate();

  return (
    <DropdownMenu
      items={[
        ...(name
          ? [
              {
                key: 'name',
                label: tct('[type] name: [name]', {
                  type: <b>{type}</b>,
                  name: <b>{name}</b>,
                }),
                children: [
                  {
                    key: 'name_add',
                    label: t('Add to filter'),
                    onAction: generateAction({
                      key: `${type}.name`,
                      value: name ?? '',
                      edit: 'set',
                      location,
                      navigate,
                    }),
                  },
                  {
                    key: 'name_exclude',
                    label: t('Exclude from filter'),
                    onAction: generateAction({
                      key: `${type}.name`,
                      value: name ?? '',
                      edit: 'remove',
                      location,
                      navigate,
                    }),
                  },
                ],
              },
            ]
          : []),
        ...(version
          ? [
              {
                key: 'version',
                label: tct('[type] version: [version]', {
                  type: <b>{type}</b>,
                  version: <b>{version}</b>,
                }),
                children: [
                  {
                    key: 'version_add',
                    label: t('Add to filter'),
                    onAction: generateAction({
                      key: `${type}.version`,
                      value: version ?? '',
                      edit: 'set',
                      location,
                      navigate,
                    }),
                  },
                  {
                    key: 'version_exclude',
                    label: t('Exclude from filter'),
                    onAction: generateAction({
                      key: `${type}.version`,
                      value: version ?? '',
                      edit: 'remove',
                      location,
                      navigate,
                    }),
                  },
                ],
              },
            ]
          : []),
      ]}
      usePortal
      size="xs"
      offset={4}
      position="bottom"
      preventOverflowOptions={{padding: 4}}
      flipOptions={{
        fallbackPlacements: ['top', 'right-start', 'right-end', 'left-start', 'left-end'],
      }}
      trigger={triggerProps => (
        <ActionMenuTrigger
          {...triggerProps}
          translucentBorder
          aria-label={t('Actions')}
          icon={<IconEllipsis size="xs" />}
          size="zero"
        />
      )}
    />
  );
}

const DEFAULT_NUMERIC_DROPDOWN_FORMATTER = (val: number) => val.toString();

function NumericDropdownFilter({
  type,
  val,
  triggerOverlay,
  formatter = DEFAULT_NUMERIC_DROPDOWN_FORMATTER,
}: {
  type: string;
  val: number;
  formatter?: (val: number) => string;
  triggerOverlay?: boolean;
}) {
  const location = useLocation<ReplayListLocationQuery>();
  const navigate = useNavigate();

  return (
    <DropdownMenu
      items={[
        {
          key: 'add',
          label: 'Add to filter',
          onAction: generateAction({
            key: type,
            value: formatter(val),
            edit: 'set',
            location,
            navigate,
          }),
        },
        {
          key: 'greater',
          label: 'Show values greater than',
          onAction: generateAction({
            key: type,
            value: '>' + formatter(val),
            edit: 'set',
            location,
            navigate,
          }),
        },
        {
          key: 'less',
          label: 'Show values less than',
          onAction: generateAction({
            key: type,
            value: '<' + formatter(val),
            edit: 'set',
            location,
            navigate,
          }),
        },
        {
          key: 'exclude',
          label: t('Exclude from filter'),
          onAction: generateAction({
            key: type,
            value: formatter(val),
            edit: 'remove',
            location,
            navigate,
          }),
        },
      ]}
      usePortal
      size="xs"
      offset={4}
      position="bottom"
      preventOverflowOptions={{padding: 4}}
      flipOptions={{
        fallbackPlacements: ['top', 'right-start', 'right-end', 'left-start', 'left-end'],
      }}
      trigger={triggerProps =>
        triggerOverlay ? (
          <OverlayActionMenuTrigger
            {...triggerProps}
            translucentBorder
            aria-label={t('Actions')}
            icon={<IconEllipsis size="xs" />}
            size="zero"
          />
        ) : (
          <NumericActionMenuTrigger
            {...triggerProps}
            translucentBorder
            aria-label={t('Actions')}
            icon={<IconEllipsis size="xs" />}
            size="zero"
          />
        )
      }
    />
  );
}

function getUserBadgeUser(replay: Props['replay']) {
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

export function ReplayCell({
  eventView,
  referrer,
  replay,
  referrerTable,
  isWidget,
  className,
}: Props & {
  eventView: EventView;
  referrer: string;
  className?: string;
  isWidget?: boolean;
  referrerTable?: ReferrerTableType;
}) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const project = projects.find(p => p.id === replay.project_id);

  const location = useLocation();
  const isIssuesReplayList = location.pathname.includes('issues');

  const replayDetailsPathname = makeReplaysPathname({
    path: `/${replay.id}/`,
    organization,
  });

  const detailsTab = () => ({
    pathname: replayDetailsPathname,
    query: {
      referrer,
      ...eventView.generateQueryStringObject(),
      f_b_type: referrerTable === 'selector-widget' ? 'rageOrDead' : undefined,
    },
  });

  const trackNavigationEvent = () =>
    trackAnalytics('replay.list-navigate-to-details', {
      project_id: project?.id,
      platform: project?.platform,
      organization,
      referrer,
      referrer_table: referrerTable,
    });

  if (replay.is_archived) {
    return (
      <Item isArchived={replay.is_archived} isReplayCell>
        <Row gap={1}>
          <StyledIconDelete color="gray500" size="md" />
          <div>
            <Row gap={0.5}>{t('Deleted Replay')}</Row>
            <Row gap={0.5}>
              {project ? <ProjectAvatar size={12} project={project} /> : null}
              <ArchivedId>{getShortEventId(replay.id)}</ArchivedId>
            </Row>
          </div>
        </Row>
      </Item>
    );
  }

  invariant(
    replay.started_at,
    'For TypeScript: replay.started_at is implied because replay.is_archived is false'
  );

  return (
    <Item isWidget={isWidget} isReplayCell className={className}>
      <Row gap={1}>
        <UserAvatar user={getUserBadgeUser(replay)} size={24} />
        <SubText>
          <Row gap={0.5}>
            {replay.is_archived ? (
              replay.user.display_name || t('Anonymous User')
            ) : (
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
            )}
          </Row>
          <Row gap={0.5}>
            {/* Avatar is used instead of ProjectBadge because using ProjectBadge increases spacing, which doesn't look as good */}
            {project ? <ProjectAvatar size={12} project={project} /> : null}
            {project ? project.slug : null}
            <Link to={detailsTab()} onClick={trackNavigationEvent}>
              {getShortEventId(replay.id)}
            </Link>
            <Row gap={0.5}>
              <IconCalendar color="gray300" size="xs" />
              <TimeSince date={replay.started_at} />
            </Row>
          </Row>
        </SubText>
      </Row>
    </Item>
  );
}

const ArchivedId = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
`;

const StyledIconDelete = styled(IconDelete)`
  margin: ${space(0.25)};
`;

const Row = styled('div')<{gap: ValidSize; minWidth?: number}>`
  display: flex;
  gap: ${p => space(p.gap)};
  align-items: center;
  ${p => (p.minWidth ? `min-width: ${p.minWidth}px;` : '')}
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

const SubText = styled('div')`
  font-size: 0.875em;
  line-height: normal;
  color: ${p => p.theme.subText};
  ${p => p.theme.overflowEllipsis};
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
`;

export function TransactionCell({replay}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const theme = useTheme();

  if (replay.is_archived) {
    return <Item isArchived />;
  }
  const hasTxEvent = 'txEvent' in replay;
  const txDuration = hasTxEvent ? replay.txEvent?.['transaction.duration'] : undefined;
  return hasTxEvent ? (
    <Item>
      <SpanOperationBreakdown>
        {txDuration ? <div>{txDuration}ms</div> : null}
        {spanOperationRelativeBreakdownRenderer(
          replay.txEvent,
          {organization, location, theme},
          {enableOnClick: false}
        )}
      </SpanOperationBreakdown>
    </Item>
  ) : null;
}

export function OSCell({replay, showDropdownFilters}: Props) {
  const {name, version} = replay.os;
  const theme = useTheme();
  const hasRoomForColumns = useMedia(`(min-width: ${theme.breakpoints.lg})`);

  if (replay.is_archived) {
    return <Item isArchived />;
  }
  return (
    <Item>
      <Container>
        <Tooltip title={`${name ?? ''} ${version ?? ''}`}>
          <ReplayPlatformIcon
            name={name ?? ''}
            version={version && hasRoomForColumns ? version : undefined}
            showVersion={false}
            showTooltip={false}
          />
          {showDropdownFilters ? (
            <OSBrowserDropdownFilter type="os" name={name} version={version} />
          ) : null}
        </Tooltip>
      </Container>
    </Item>
  );
}

export function BrowserCell({replay, showDropdownFilters}: Props) {
  const {name, version} = replay.browser;
  const theme = useTheme();
  const hasRoomForColumns = useMedia(`(min-width: ${theme.breakpoints.lg})`);

  if (replay.is_archived) {
    return <Item isArchived />;
  }

  if (name === null && version === null) {
    return (
      <Item>
        <IconNot size="xs" color="gray300" />
      </Item>
    );
  }
  return (
    <Item>
      <Container>
        <Tooltip title={`${name} ${version}`}>
          <ReplayPlatformIcon
            name={name ?? ''}
            version={version && hasRoomForColumns ? version : undefined}
            showVersion={false}
            showTooltip={false}
          />
          {showDropdownFilters ? (
            <OSBrowserDropdownFilter type="browser" name={name} version={version} />
          ) : null}
        </Tooltip>
      </Container>
    </Item>
  );
}

export function DurationCell({replay, showDropdownFilters}: Props) {
  if (replay.is_archived) {
    return <Item isArchived />;
  }
  invariant(
    replay.duration,
    'For TypeScript: replay.duration is implied because replay.is_archived is false'
  );
  return (
    <Item>
      <Container>
        <Duration duration={[replay.duration.asMilliseconds(), 'ms']} precision="sec" />
        {showDropdownFilters ? (
          <NumericDropdownFilter
            type="duration"
            val={replay.duration.asSeconds()}
            formatter={(val: number) => `${val}s`}
          />
        ) : null}
      </Container>
    </Item>
  );
}

export function RageClickCountCell({replay, showDropdownFilters}: Props) {
  if (replay.is_archived) {
    return <Item isArchived />;
  }
  return (
    <Item data-test-id="replay-table-count-rage-clicks">
      <Container>
        {replay.count_rage_clicks ? (
          <RageClickCount>
            <IconCursorArrow size="sm" color="red300" />
            {replay.count_rage_clicks}
          </RageClickCount>
        ) : (
          <Count>0</Count>
        )}
        {showDropdownFilters ? (
          <NumericDropdownFilter
            type="count_rage_clicks"
            val={replay.count_rage_clicks ?? 0}
          />
        ) : null}
      </Container>
    </Item>
  );
}

export function DeadClickCountCell({replay, showDropdownFilters}: Props) {
  if (replay.is_archived) {
    return <Item isArchived />;
  }
  return (
    <Item data-test-id="replay-table-count-dead-clicks">
      <Container>
        {replay.count_dead_clicks ? (
          <DeadClickCount>
            <IconCursorArrow size="sm" color="yellow300" />
            {replay.count_dead_clicks}
          </DeadClickCount>
        ) : (
          <Count>0</Count>
        )}
        {showDropdownFilters ? (
          <NumericDropdownFilter
            type="count_dead_clicks"
            val={replay.count_dead_clicks ?? 0}
          />
        ) : null}
      </Container>
    </Item>
  );
}

export function ErrorCountCell({replay, showDropdownFilters}: Props) {
  if (replay.is_archived) {
    return <Item isArchived />;
  }
  return (
    <Item data-test-id="replay-table-count-errors">
      <Container>
        {replay.count_errors ? (
          <ErrorCount>
            <IconFire color="red300" />
            {replay.count_errors}
          </ErrorCount>
        ) : (
          <Count>0</Count>
        )}
        {showDropdownFilters ? (
          <NumericDropdownFilter type="count_errors" val={replay.count_errors ?? 0} />
        ) : null}
      </Container>
    </Item>
  );
}

export function ActivityCell({replay, showDropdownFilters}: Props) {
  const theme = useTheme();
  if (replay.is_archived) {
    return <Item isArchived />;
  }
  const colors = theme.chart.getColorPalette(0);
  const scoreBarPalette = new Array(10).fill([colors[0]]);
  return (
    <Item>
      <Container>
        <ScoreBar
          size={20}
          score={replay?.activity ?? 1}
          palette={scoreBarPalette}
          radius={0}
        />
        {showDropdownFilters ? (
          <NumericDropdownFilter
            type="activity"
            val={replay?.activity ?? 0}
            triggerOverlay
          />
        ) : null}
      </Container>
    </Item>
  );
}

export function PlayPauseCell({rowIndex}: Props) {
  const {index: selectedReplayIndex, select: setSelectedReplayIndex} =
    useSelectedReplayIndex();
  const inner =
    rowIndex === selectedReplayIndex ? (
      <ReplayPlayPauseButton size="sm" priority="default" borderless />
    ) : (
      <Button
        title={t('Play')}
        aria-label={t('Play')}
        icon={<IconPlay size="sm" />}
        onClick={() => setSelectedReplayIndex(rowIndex)}
        data-test-id="replay-table-play-button"
        borderless
        size="sm"
        priority="default"
      />
    );
  return <Item>{inner}</Item>;
}

const Item = styled('div')<{
  isArchived?: boolean;
  isReplayCell?: boolean;
  isWidget?: boolean;
}>`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  ${p =>
    p.isWidget
      ? `padding: ${space(0.75)} ${space(1.5)} ${space(1.5)} ${space(1.5)};`
      : `padding: ${space(1.5)};`};
  ${p => (p.isArchived ? 'opacity: 0.5;' : '')};
  ${p => (p.isReplayCell ? 'overflow: auto;' : '')};
`;

const Count = styled('span')`
  font-variant-numeric: tabular-nums;
`;

const DeadClickCount = styled(Count)`
  display: flex;
  width: 40px;
  gap: ${space(0.5)};
`;

const RageClickCount = styled(Count)`
  display: flex;
  width: 40px;
  gap: ${space(0.5)};
`;

const ErrorCount = styled(Count)`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
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

const Container = styled('div')`
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const ActionMenuTrigger = styled(Button)`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  padding: ${space(0.75)};
  left: -${space(0.75)};
  display: flex;
  align-items: center;
  opacity: 0;
  transition: opacity 0.1s;
  &:focus-visible,
  &[aria-expanded='true'],
  ${Container}:hover & {
    opacity: 1;
  }
`;

const NumericActionMenuTrigger = styled(ActionMenuTrigger)`
  left: 100%;
  margin-left: ${space(0.75)};
  z-index: 1;
`;

const OverlayActionMenuTrigger = styled(NumericActionMenuTrigger)`
  right: 0%;
  left: unset;
`;
