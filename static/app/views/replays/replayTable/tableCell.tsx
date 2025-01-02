import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import Avatar from 'sentry/components/avatar';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import {Button} from 'sentry/components/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import Duration from 'sentry/components/duration/duration';
import Link from 'sentry/components/links/link';
import PlatformIcon from 'sentry/components/replays/platformIcon';
import ReplayPlayPauseButton from 'sentry/components/replays/replayPlayPauseButton';
import ScoreBar from 'sentry/components/scoreBar';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {
  IconCalendar,
  IconCursorArrow,
  IconDelete,
  IconEllipsis,
  IconFire,
  IconPlay,
} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {ValidSize} from 'sentry/styles/space';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import type EventView from 'sentry/utils/discover/eventView';
import {spanOperationRelativeBreakdownRenderer} from 'sentry/utils/discover/fieldRenderers';
import {getShortEventId} from 'sentry/utils/events';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useProjects from 'sentry/utils/useProjects';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysWithTxData';
import type {ReplayListLocationQuery, ReplayListRecord} from 'sentry/views/replays/types';

type Props = {
  replay: ReplayListRecord | ReplayListRecordWithTx;
  showDropdownFilters?: boolean;
};

export type ReferrerTableType = 'main' | 'selector-widget';

type EditType = 'set' | 'remove';

function generateAction({
  key,
  value,
  edit,
  location,
}: {
  edit: EditType;
  key: string;
  location: Location<ReplayListLocationQuery>;
  value: string;
}) {
  const search = new MutableSearch(decodeScalar(location.query.query) || '');

  const modifiedQuery =
    edit === 'set' ? search.setFilterValues(key, [value]) : search.removeFilter(key);

  const onAction = () => {
    browserHistory.push({
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
  organization,
  referrer,
  replay,
  referrer_table,
  isWidget,
  className,
}: Props & {
  eventView: EventView;
  organization: Organization;
  referrer: string;
  className?: string;
  isWidget?: boolean;
  referrer_table?: ReferrerTableType;
}) {
  const {projects} = useProjects();
  const project = projects.find(p => p.id === replay.project_id);

  const replayDetails = {
    pathname: normalizeUrl(`/organizations/${organization.slug}/replays/${replay.id}/`),
    query: {
      referrer,
      ...eventView.generateQueryStringObject(),
    },
  };

  const replayDetailsDeadRage = {
    pathname: normalizeUrl(`/organizations/${organization.slug}/replays/${replay.id}/`),
    query: {
      referrer,
      ...eventView.generateQueryStringObject(),
      f_b_type: 'rageOrDead',
    },
  };

  const detailsTab = () => {
    switch (referrer_table) {
      case 'selector-widget':
        return replayDetailsDeadRage;
      default:
        return replayDetails;
    }
  };

  const trackNavigationEvent = () =>
    trackAnalytics('replay.list-navigate-to-details', {
      project_id: project?.id,
      platform: project?.platform,
      organization,
      referrer,
      referrer_table,
    });

  if (replay.is_archived) {
    return (
      <Item isArchived={replay.is_archived} isReplayCell>
        <Row gap={1}>
          <StyledIconDelete color="gray500" size="md" />
          <div>
            <Row gap={0.5}>{t('Deleted Replay')}</Row>
            <Row gap={0.5}>
              {project ? <Avatar size={12} project={project} /> : null}
              <ArchivedId>{getShortEventId(replay.id)}</ArchivedId>
            </Row>
          </div>
        </Row>
      </Item>
    );
  }

  const subText = (
    <Cols>
      <Row gap={1}>
        <Row gap={0.5}>
          {/* Avatar is used instead of ProjectBadge because using ProjectBadge increases spacing, which doesn't look as good */}
          {project ? <Avatar size={12} project={project} /> : null}
          {project ? project.slug : null}
          <Link to={detailsTab()} onClick={trackNavigationEvent}>
            {getShortEventId(replay.id)}
          </Link>
          <Row gap={0.5}>
            <IconCalendar color="gray300" size="xs" />
            <TimeSince date={replay.started_at} />
          </Row>
        </Row>
      </Row>
    </Cols>
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
              <MainLink
                to={detailsTab()}
                onClick={trackNavigationEvent}
                data-has-viewed={replay.has_viewed}
              >
                {replay.user.display_name || t('Anonymous User')}
              </MainLink>
            )}
          </Row>
          <Row gap={0.5}>{subText}</Row>
        </SubText>
      </Row>
    </Item>
  );
}

const ArchivedId = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledIconDelete = styled(IconDelete)`
  margin: ${space(0.25)};
`;

const Cols = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  width: 100%;
`;

const Row = styled('div')<{gap: ValidSize; minWidth?: number}>`
  display: flex;
  gap: ${p => space(p.gap)};
  align-items: center;
  ${p => (p.minWidth ? `min-width: ${p.minWidth}px;` : '')}
`;

const MainLink = styled(Link)`
  font-size: ${p => p.theme.fontSizeLarge};
  line-height: normal;
  ${p => p.theme.overflowEllipsis};

  font-weight: ${p => p.theme.fontWeightBold};
  &[data-has-viewed='true'] {
    font-weight: ${p => p.theme.fontWeightNormal};
  }
`;

const SubText = styled('div')`
  font-size: 0.875em;
  line-height: normal;
  color: ${p => p.theme.gray300};
  ${p => p.theme.overflowEllipsis};
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
`;

export function TransactionCell({
  organization,
  replay,
}: Props & {organization: Organization}) {
  const location = useLocation();

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
          {organization, location},
          {enableOnClick: false}
        )}
      </SpanOperationBreakdown>
    </Item>
  ) : null;
}

export function OSCell({replay, showDropdownFilters}: Props) {
  const {name, version} = replay.os ?? {};
  const theme = useTheme();
  const hasRoomForColumns = useMedia(`(min-width: ${theme.breakpoints.large})`);

  if (replay.is_archived) {
    return <Item isArchived />;
  }
  return (
    <Item>
      <Container>
        <Tooltip title={`${name ?? ''} ${version ?? ''}`}>
          <PlatformIcon
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
  const {name, version} = replay.browser ?? {};
  const theme = useTheme();
  const hasRoomForColumns = useMedia(`(min-width: ${theme.breakpoints.large})`);

  if (replay.is_archived) {
    return <Item isArchived />;
  }
  return (
    <Item>
      <Container>
        <Tooltip title={`${name} ${version}`}>
          <PlatformIcon
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
  if (replay.is_archived) {
    return <Item isArchived />;
  }
  const scoreBarPalette = new Array(10).fill([CHART_PALETTE[0]![0]]);
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

export function PlayPauseCell({
  isSelected,
  handleClick,
}: {
  handleClick: () => void;
  isSelected: boolean;
}) {
  const inner = isSelected ? (
    <ReplayPlayPauseButton size="sm" priority="default" borderless />
  ) : (
    <Button
      title={t('Play')}
      aria-label={t('Play')}
      icon={<IconPlay size="sm" />}
      onClick={handleClick}
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
  font-size: ${p => p.theme.fontSizeMedium};
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
