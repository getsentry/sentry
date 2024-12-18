import {Fragment, type PropsWithChildren, useMemo} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {Button, LinkButton} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {
  DropdownMenu,
  type DropdownMenuProps,
  type MenuItemProps,
} from 'sentry/components/dropdownMenu';
import EventTagsDataSection from 'sentry/components/events/eventTagsAndScreenshot/tags';
import {generateStats} from 'sentry/components/events/opsBreakdown';
import {DataSection} from 'sentry/components/events/styles';
import FileSize from 'sentry/components/fileSize';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import KeyValueData, {
  CardPanel,
  type KeyValueDataContentProps,
  Subject,
} from 'sentry/components/keyValueData';
import {LazyRender, type LazyRenderProps} from 'sentry/components/lazyRender';
import Link from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {Tooltip} from 'sentry/components/tooltip';
import {
  IconChevron,
  IconCircleFill,
  IconFocus,
  IconJson,
  IconOpen,
  IconPanel,
  IconProfiling,
} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, EventTransaction} from 'sentry/types/event';
import type {KeyValueListData} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import getDuration from 'sentry/utils/duration/getDuration';
import type {Color, ColorOrAlias} from 'sentry/utils/theme';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {traceAnalytics} from '../../traceAnalytics';
import {useTransaction} from '../../traceApi/useTransaction';
import {useDrawerContainerRef} from '../../traceDrawer/details/drawerContainerRefContext';
import {makeTraceContinuousProfilingLink} from '../../traceDrawer/traceProfilingLink';
import {
  isAutogroupedNode,
  isMissingInstrumentationNode,
  isRootNode,
  isSpanNode,
  isTraceErrorNode,
  isTransactionNode,
} from '../../traceGuards';
import type {MissingInstrumentationNode} from '../../traceModels/missingInstrumentationNode';
import type {ParentAutogroupNode} from '../../traceModels/parentAutogroupNode';
import type {SiblingAutogroupNode} from '../../traceModels/siblingAutogroupNode';
import {TraceTree} from '../../traceModels/traceTree';
import type {TraceTreeNode} from '../../traceModels/traceTreeNode';
import {useTraceState, useTraceStateDispatch} from '../../traceState/traceStateProvider';
import {useHasTraceNewUi} from '../../useHasTraceNewUi';

const DetailContainer = styled('div')<{hasNewTraceUi?: boolean}>`
  display: flex;
  flex-direction: column;
  gap: ${p => (p.hasNewTraceUi ? 0 : space(2))};
  padding: ${p => (p.hasNewTraceUi ? `${space(1)} ${space(2)}` : space(1))};

  ${DataSection} {
    padding: 0;
  }
`;

const FlexBox = styled('div')`
  display: flex;
  align-items: center;
`;

const Actions = styled(FlexBox)`
  gap: ${space(0.5)};
  justify-content: end;
  width: 100%;
`;

const Title = styled(FlexBox)`
  gap: ${space(1)};
  flex-grow: 1;
  overflow: hidden;
  > span {
    min-width: 30px;
  }
`;

const LegacyTitleText = styled('div')`
  ${p => p.theme.overflowEllipsis}
`;

const TitleText = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: bold;
`;

function TitleWithTestId(props: PropsWithChildren<{}>) {
  return <Title data-test-id="trace-drawer-title">{props.children}</Title>;
}

function SubtitleWithCopyButton({
  text,
  hideCopyButton = false,
}: {
  text: string;
  hideCopyButton?: boolean;
}) {
  return (
    <SubTitleWrapper>
      <StyledSubTitleText>{text}</StyledSubTitleText>
      {!hideCopyButton ? (
        <CopyToClipboardButton
          borderless
          size="zero"
          iconSize="xs"
          text={text}
          tooltipProps={{disabled: true}}
        />
      ) : null}
    </SubTitleWrapper>
  );
}

const SubTitleWrapper = styled(FlexBox)`
  ${p => p.theme.overflowEllipsis}
`;

const StyledSubTitleText = styled('span')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
`;

function TitleOp({text}: {text: string}) {
  return (
    <Tooltip
      title={
        <Fragment>
          {text}
          <CopyToClipboardButton
            borderless
            size="zero"
            iconSize="xs"
            text={text}
            tooltipProps={{disabled: true}}
          />
        </Fragment>
      }
      showOnlyOnOverflow
      isHoverable
    >
      <TitleOpText>{text}</TitleOpText>
    </Tooltip>
  );
}

const Type = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
`;

const TitleOpText = styled('div')`
  font-size: 15px;
  font-weight: ${p => p.theme.fontWeightBold};
  ${p => p.theme.overflowEllipsis}
`;

const Table = styled('table')`
  margin-bottom: 0 !important;

  td {
    overflow: hidden;
  }
`;

const IconTitleWrapper = styled(FlexBox)`
  gap: ${space(1)};
  min-width: 30px;
`;

const IconBorder = styled('div')<{backgroundColor: string; errored?: boolean}>`
  background-color: ${p => p.backgroundColor};
  border-radius: ${p => p.theme.borderRadius};
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  min-width: 30px;

  svg {
    fill: ${p => p.theme.white};
    width: 14px;
    height: 14px;
  }
`;

const LegacyHeaderContainer = styled(FlexBox)`
  justify-content: space-between;
  gap: ${space(3)};
  container-type: inline-size;

  @container (max-width: 780px) {
    .DropdownMenu {
      display: block;
    }
    .Actions {
      display: none;
    }
  }

  @container (min-width: 781px) {
    .DropdownMenu {
      display: none;
    }
  }
`;

const HeaderContainer = styled(FlexBox)`
  align-items: baseline;
  justify-content: space-between;
  gap: ${space(3)};
  margin-bottom: ${space(1.5)};
`;

const DURATION_COMPARISON_STATUS_COLORS: {
  equal: {light: ColorOrAlias; normal: ColorOrAlias};
  faster: {light: ColorOrAlias; normal: ColorOrAlias};
  slower: {light: ColorOrAlias; normal: ColorOrAlias};
} = {
  faster: {
    light: 'green100',
    normal: 'green300',
  },
  slower: {
    light: 'red100',
    normal: 'red300',
  },
  equal: {
    light: 'gray100',
    normal: 'gray300',
  },
};

const MIN_PCT_DURATION_DIFFERENCE = 10;

type DurationComparison = {
  deltaPct: number;
  deltaText: JSX.Element;
  status: 'faster' | 'slower' | 'equal';
} | null;

const getDurationComparison = (
  baseline: number | undefined,
  duration: number,
  baseDescription?: string
): DurationComparison => {
  if (!baseline) {
    return null;
  }

  const delta = duration - baseline;
  const deltaPct = Math.round(Math.abs((delta / baseline) * 100));
  const status = delta > 0 ? 'slower' : delta < 0 ? 'faster' : 'equal';

  const formattedBaseDuration = (
    <Tooltip
      title={baseDescription}
      showUnderline
      underlineColor={DURATION_COMPARISON_STATUS_COLORS[status].normal}
    >
      {getDuration(baseline, 2, true)}
    </Tooltip>
  );

  const deltaText =
    status === 'equal'
      ? tct(`equal to avg [formattedBaseDuration]`, {
          formattedBaseDuration,
        })
      : status === 'faster'
        ? tct(`[deltaPct] faster than avg [formattedBaseDuration]`, {
            formattedBaseDuration,
            deltaPct: `${deltaPct}%`,
          })
        : tct(`[deltaPct] slower than avg [formattedBaseDuration]`, {
            formattedBaseDuration,
            deltaPct: `${deltaPct}%`,
          });

  return {deltaPct, status, deltaText};
};

type DurationProps = {
  baseline: number | undefined;
  duration: number;
  node: TraceTreeNode<TraceTree.NodeValue>;
  baseDescription?: string;
  ratio?: number;
};

function Duration(props: DurationProps) {
  if (typeof props.duration !== 'number' || Number.isNaN(props.duration)) {
    return <DurationContainer>{t('unknown')}</DurationContainer>;
  }

  // Since transactions have ms precision, we show 2 decimal places only if the duration is greater than 1 second.
  const precision = isTransactionNode(props.node) ? (props.duration > 1 ? 2 : 0) : 2;
  if (props.baseline === undefined || props.baseline === 0) {
    return (
      <DurationContainer>
        {getDuration(props.duration, precision, true)}
      </DurationContainer>
    );
  }

  const comparison = getDurationComparison(
    props.baseline,
    props.duration,
    props.baseDescription
  );

  return (
    <Fragment>
      <DurationContainer>
        {getDuration(props.duration, precision, true)}{' '}
        {props.ratio ? `(${(props.ratio * 100).toFixed()}%)` : null}
      </DurationContainer>
      {comparison && comparison.deltaPct >= MIN_PCT_DURATION_DIFFERENCE ? (
        <Comparison status={comparison.status}>{comparison.deltaText}</Comparison>
      ) : null}
    </Fragment>
  );
}

function TableRow({
  title,
  keep,
  children,
  prefix,
  extra = null,
  toolTipText,
}: {
  children: React.ReactNode;
  title: JSX.Element | string | null;
  extra?: React.ReactNode;
  keep?: boolean;
  prefix?: JSX.Element;
  toolTipText?: string;
}) {
  if (!keep && !children) {
    return null;
  }

  return (
    <tr>
      <td className="key">
        <Flex>
          {prefix}
          {title}
          {toolTipText ? <StyledQuestionTooltip size="xs" title={toolTipText} /> : null}
        </Flex>
      </td>
      <ValueTd className="value">
        <TableValueRow>
          <StyledPre>
            <span className="val-string">{children}</span>
          </StyledPre>
          <TableRowButtonContainer>{extra}</TableRowButtonContainer>
        </TableValueRow>
      </ValueTd>
    </tr>
  );
}

type HighlightProps = {
  avgDuration: number | undefined;
  bodyContent: React.ReactNode;
  headerContent: React.ReactNode;
  node: TraceTreeNode<TraceTree.NodeValue>;
  project: Project | undefined;
  transaction: EventTransaction | undefined;
};

function Highlights({
  node,
  transaction: event,
  avgDuration,
  project,
  headerContent,
  bodyContent,
}: HighlightProps) {
  if (!isTransactionNode(node) && !isSpanNode(node)) {
    return null;
  }

  const startTimestamp = node.space[0];
  const endTimestamp = node.space[0] + node.space[1];
  const durationInSeconds = (endTimestamp - startTimestamp) / 1e3;

  const comparison = getDurationComparison(
    avgDuration,
    durationInSeconds,
    t('Average duration for this transaction over the last 24 hours')
  );

  return (
    <Fragment>
      <HighlightsWrapper>
        <HighlightsLeftColumn>
          <Tooltip title={node.value?.project_slug}>
            <ProjectBadge
              project={project ? project : {slug: node.value?.project_slug ?? ''}}
              avatarSize={18}
              hideName
            />
          </Tooltip>
          <VerticalLine />
        </HighlightsLeftColumn>
        <HighlightsRightColumn>
          <HighlightOp>
            {isTransactionNode(node) ? node.value?.['transaction.op'] : node.value?.op}
          </HighlightOp>
          <HighlightsDurationWrapper>
            <HighlightDuration>
              {getDuration(durationInSeconds, 2, true)}
            </HighlightDuration>
            {comparison && comparison.deltaPct >= MIN_PCT_DURATION_DIFFERENCE ? (
              <HiglightsDurationComparison status={comparison.status}>
                {comparison.deltaText}
              </HiglightsDurationComparison>
            ) : null}
          </HighlightsDurationWrapper>
          <StyledPanel>
            <StyledPanelHeader>{headerContent}</StyledPanelHeader>
            <PanelBody>{bodyContent}</PanelBody>
          </StyledPanel>
          {event ? <HighLightsOpsBreakdown event={event} /> : null}
        </HighlightsRightColumn>
      </HighlightsWrapper>
      <SectionDivider />
    </Fragment>
  );
}

const StyledPanel = styled(Panel)`
  margin-bottom: 0;
`;

function HighLightsOpsBreakdown({event}: {event: EventTransaction}) {
  const breakdown = generateStats(event, {type: 'no_filter'});

  return (
    <HighlightsOpsBreakdownWrapper>
      <HighlightsSpanCount>
        {t('Most frequent span ops for this transaction are')}
      </HighlightsSpanCount>
      <TopOpsList>
        {breakdown.slice(0, 3).map(currOp => {
          const {name, percentage} = currOp;

          const operationName = typeof name === 'string' ? name : t('Other');
          const color = pickBarColor(operationName);
          const pctLabel = isFinite(percentage) ? Math.round(percentage * 100) : '∞';

          return (
            <HighlightsOpRow key={operationName}>
              <IconCircleFill size="xs" color={color as Color} />
              {operationName}
              <HighlightsOpPct>{pctLabel}%</HighlightsOpPct>
            </HighlightsOpRow>
          );
        })}
      </TopOpsList>
    </HighlightsOpsBreakdownWrapper>
  );
}

const TopOpsList = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
`;

const HighlightsOpPct = styled('div')`
  color: ${p => p.theme.subText};
  font-size: 14px;
`;

const HighlightsSpanCount = styled('div')`
  margin-bottom: ${space(0.25)};
`;

const HighlightsOpRow = styled(FlexBox)`
  font-size: 13px;
  gap: ${space(0.5)};
`;

const HighlightsOpsBreakdownWrapper = styled(FlexBox)`
  align-items: flex-start;
  flex-direction: column;
  gap: ${space(0.25)};
  margin-top: ${space(1.5)};
`;

const HiglightsDurationComparison = styled('div')<{status: string}>`
  white-space: nowrap;
  border-radius: 12px;
  color: ${p => p.theme[DURATION_COMPARISON_STATUS_COLORS[p.status].normal]};
  background-color: ${p => p.theme[DURATION_COMPARISON_STATUS_COLORS[p.status].light]};
  border: solid 1px ${p => p.theme[DURATION_COMPARISON_STATUS_COLORS[p.status].light]};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: ${space(0.25)} ${space(1)};
  display: inline-block;
  height: 21px;
`;

const HighlightsDurationWrapper = styled(FlexBox)`
  gap: ${space(1)};
  margin-bottom: ${space(1)};
`;

const HighlightDuration = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  font-weight: 400;
`;

const HighlightOp = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: normal;
`;

const StyledPanelHeader = styled(PanelHeader)`
  font-weight: normal;
  padding: 0;
  line-height: normal;
  text-transform: none;
  overflow: hidden;
`;

const SectionDivider = styled('hr')`
  border-color: ${p => p.theme.translucentBorder};
  margin: ${space(3)} 0 ${space(1.5)} 0;
`;

const VerticalLine = styled('div')`
  width: 1px;
  height: 100%;
  background-color: ${p => p.theme.border};
  margin-top: ${space(0.5)};
`;

const HighlightsWrapper = styled('div')`
  display: flex;
  align-items: stretch;
  gap: ${space(1)};
  width: 100%;
  overflow: hidden;
  margin: ${space(1)} 0;
`;

const HighlightsLeftColumn = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

const HighlightsRightColumn = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: left;
  height: 100%;
  flex: 1;
  overflow: hidden;
`;

function IssuesLink({
  node,
  children,
}: {
  children: React.ReactNode;
  node: TraceTreeNode<TraceTree.NodeValue>;
}) {
  const organization = useOrganization();
  const params = useParams<{traceSlug?: string}>();
  const traceSlug = params.traceSlug?.trim() ?? '';

  // Adding a buffer of 15mins for errors only traces, where there is no concept of
  // trace duration and start equals end timestamps.
  const buffer = node.space[1] > 0 ? 0 : 15 * 60 * 1000;

  return (
    <Link
      to={{
        pathname: `/organizations/${organization.slug}/issues/`,
        query: {
          query: `trace:${traceSlug}`,
          start: new Date(node.space[0] - buffer).toISOString(),
          end: new Date(node.space[0] + node.space[1] + buffer).toISOString(),
          // If we don't pass the project param, the issues page will filter by the last selected project.
          // Traces can have multiple projects, so we query issues by all projects and rely on our search query to filter the results.
          project: -1,
        },
      }}
    >
      {children}
    </Link>
  );
}

const LAZY_RENDER_PROPS: Partial<LazyRenderProps> = {
  observerOptions: {rootMargin: '50px'},
};

const DurationContainer = styled('span')`
  font-weight: ${p => p.theme.fontWeightBold};
  margin-right: ${space(1)};
`;

const Comparison = styled('span')<{status: 'faster' | 'slower' | 'equal'}>`
  color: ${p => p.theme[DURATION_COMPARISON_STATUS_COLORS[p.status].normal]};
`;

const Flex = styled('div')`
  display: flex;
  align-items: center;
`;

const TableValueRow = styled('div')`
  display: grid;
  grid-template-columns: auto min-content;
  gap: ${space(1)};

  border-radius: 4px;
  background-color: ${p => p.theme.surface200};
  margin: 2px;
`;

const StyledQuestionTooltip = styled(QuestionTooltip)`
  margin-left: ${space(0.5)};
`;

const StyledPre = styled('pre')`
  margin: 0 !important;
  background-color: transparent !important;
`;

const TableRowButtonContainer = styled('div')`
  padding: 8px 10px;
`;

const ValueTd = styled('td')`
  position: relative;
`;

function getThreadIdFromNode(
  node: TraceTreeNode<TraceTree.NodeValue>,
  transaction: EventTransaction | undefined
): string | undefined {
  if (isSpanNode(node) && node.value.data?.['thread.id']) {
    return node.value.data['thread.id'];
  }

  if (transaction) {
    return transaction.contexts?.trace?.data?.['thread.id'];
  }

  return undefined;
}

// Renders the dropdown menu list at the root trace drawer content container level, to prevent
// being stacked under other content.
function DropdownMenuWithPortal(props: DropdownMenuProps) {
  const drawerContainerRef = useDrawerContainerRef();

  return (
    <DropdownMenu
      {...props}
      usePortal={!!drawerContainerRef}
      portalContainerRef={drawerContainerRef}
    />
  );
}

function TypeSafeBoolean<T>(value: T | null | undefined): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

function PanelPositionDropDown({organization}: {organization: Organization}) {
  const traceState = useTraceState();
  const traceDispatch = useTraceStateDispatch();

  const options: MenuItemProps[] = [];

  const layoutOptions = traceState.preferences.drawer.layoutOptions;
  if (layoutOptions.includes('drawer left')) {
    options.push({
      key: 'drawer-left',
      onAction: () => {
        traceAnalytics.trackLayoutChange('drawer left', organization);
        traceDispatch({type: 'set layout', payload: 'drawer left'});
      },
      leadingItems: <IconPanel direction="left" size="xs" />,
      label: t('Left'),
      disabled: traceState.preferences.layout === 'drawer left',
    });
  }

  if (layoutOptions.includes('drawer right')) {
    options.push({
      key: 'drawer-right',
      onAction: () => {
        traceAnalytics.trackLayoutChange('drawer right', organization);
        traceDispatch({type: 'set layout', payload: 'drawer right'});
      },
      leadingItems: <IconPanel direction="right" size="xs" />,
      label: t('Right'),
      disabled: traceState.preferences.layout === 'drawer right',
    });
  }

  if (layoutOptions.includes('drawer bottom')) {
    options.push({
      key: 'drawer-bottom',
      onAction: () => {
        traceAnalytics.trackLayoutChange('drawer bottom', organization);
        traceDispatch({type: 'set layout', payload: 'drawer bottom'});
      },
      leadingItems: <IconPanel direction="down" size="xs" />,
      label: t('Bottom'),
      disabled: traceState.preferences.layout === 'drawer bottom',
    });
  }

  return (
    <DropdownMenu
      size="sm"
      items={options}
      menuTitle={<div>{t('Panel Position')}</div>}
      trigger={triggerProps => (
        <Tooltip title={t('Panel Position')}>
          <ActionButton
            {...triggerProps}
            size="xs"
            aria-label={t('Panel position')}
            icon={<IconPanel direction="right" size="xs" />}
          />
        </Tooltip>
      )}
    />
  );
}

function NodeActions(props: {
  node: TraceTreeNode<any>;
  onTabScrollToNode: (
    node:
      | TraceTreeNode<any>
      | ParentAutogroupNode
      | SiblingAutogroupNode
      | MissingInstrumentationNode
  ) => void;
  organization: Organization;
  eventSize?: number | undefined;
}) {
  const hasNewTraceUi = useHasTraceNewUi();
  const organization = useOrganization();
  const params = useParams<{traceSlug?: string}>();

  const {data: transaction} = useTransaction({
    node: isTransactionNode(props.node) ? props.node : null,
    organization,
  });

  const profilerId: string = useMemo(() => {
    if (isTransactionNode(props.node)) {
      return props.node.value.profiler_id;
    }
    if (isSpanNode(props.node)) {
      return props.node.value.sentry_tags?.profiler_id ?? '';
    }
    return '';
  }, [props]);

  const profileLink = makeTraceContinuousProfilingLink(props.node, profilerId, {
    orgSlug: props.organization.slug,
    projectSlug: props.node.metadata.project_slug ?? '',
    traceId: params.traceSlug ?? '',
    threadId: getThreadIdFromNode(props.node, transaction),
  });

  if (!hasNewTraceUi) {
    return (
      <LegacyNodeActions
        {...props}
        profileLink={profileLink}
        profilerId={profilerId}
        transaction={transaction}
      />
    );
  }

  return (
    <ActionWrapper>
      <Tooltip title={t('Show in view')}>
        <ActionButton
          onClick={_e => {
            traceAnalytics.trackShowInView(props.organization);
            props.onTabScrollToNode(props.node);
          }}
          size="xs"
          aria-label={t('Show in view')}
          icon={<IconFocus size="xs" />}
        />
      </Tooltip>
      {isTransactionNode(props.node) ? (
        <Tooltip title={t('JSON')}>
          <ActionButton
            onClick={() => traceAnalytics.trackViewEventJSON(props.organization)}
            href={`/api/0/projects/${props.organization.slug}/${props.node.value.project_slug}/events/${props.node.value.event_id}/json/`}
            size="xs"
            aria-label={t('JSON')}
            icon={<IconJson size="xs" />}
          />
        </Tooltip>
      ) : null}
      {profileLink ? (
        <Tooltip title={t('Continuous Profile')}>
          <ActionButton
            size="xs"
            aria-label={t('Continuous Profile')}
            icon={<IconProfiling size="xs" />}
          />
        </Tooltip>
      ) : null}
      <PanelPositionDropDown organization={organization} />
    </ActionWrapper>
  );
}

const ActionButton = styled(Button)`
  border: none;
  background-color: transparent;
  box-shadow: none;
  transition: none !important;
  opacity: 0.8;
  height: 24px;
  max-height: 24px;

  &:hover {
    border: none;
    background-color: transparent;
    box-shadow: none;
    opacity: 1;
  }
`;

const ActionWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.25)};
`;

function LegacyNodeActions(props: {
  node: TraceTreeNode<any>;
  onTabScrollToNode: (
    node:
      | TraceTreeNode<any>
      | ParentAutogroupNode
      | SiblingAutogroupNode
      | MissingInstrumentationNode
  ) => void;
  profileLink: LocationDescriptor | null;
  profilerId: string;
  transaction: EventTransaction | undefined;
  eventSize?: number | undefined;
}) {
  const navigate = useNavigate();
  const organization = useOrganization();

  const items = useMemo((): MenuItemProps[] => {
    const showInView: MenuItemProps = {
      key: 'show-in-view',
      label: t('Show in View'),
      onAction: () => {
        traceAnalytics.trackShowInView(organization);
        props.onTabScrollToNode(props.node);
      },
    };

    const eventId =
      props.node.metadata.event_id ??
      TraceTree.ParentTransaction(props.node)?.metadata.event_id;
    const projectSlug =
      props.node.metadata.project_slug ??
      TraceTree.ParentTransaction(props.node)?.metadata.project_slug;

    const eventSize = props.eventSize;
    const jsonDetails: MenuItemProps = {
      key: 'json-details',
      onAction: () => {
        traceAnalytics.trackViewEventJSON(organization);
        window.open(
          `/api/0/projects/${organization.slug}/${projectSlug}/events/${eventId}/json/`,
          '_blank'
        );
      },
      label:
        t('JSON') +
        (typeof eventSize === 'number' ? ` (${formatBytesBase10(eventSize, 0)})` : ''),
    };

    const continuousProfileLink: MenuItemProps | null = props.profileLink
      ? {
          key: 'continuous-profile',
          onAction: () => {
            traceAnalytics.trackViewContinuousProfile(organization);
            navigate(props.profileLink!);
          },
          label: t('Continuous Profile'),
        }
      : null;

    if (isTransactionNode(props.node)) {
      return [showInView, jsonDetails, continuousProfileLink].filter(TypeSafeBoolean);
    }
    if (isSpanNode(props.node)) {
      return [showInView, continuousProfileLink].filter(TypeSafeBoolean);
    }
    if (isMissingInstrumentationNode(props.node)) {
      return [showInView, continuousProfileLink].filter(TypeSafeBoolean);
    }
    if (isTraceErrorNode(props.node)) {
      return [showInView, continuousProfileLink].filter(TypeSafeBoolean);
    }
    if (isRootNode(props.node)) {
      return [showInView];
    }
    if (isAutogroupedNode(props.node)) {
      return [showInView];
    }

    return [showInView];
  }, [props, navigate, organization]);

  return (
    <ActionsContainer>
      <Actions className="Actions">
        {props.profileLink ? (
          <LinkButton size="xs" to={props.profileLink}>
            {t('Continuous Profile')}
          </LinkButton>
        ) : null}
        <Button
          size="xs"
          onClick={_e => {
            traceAnalytics.trackShowInView(organization);
            props.onTabScrollToNode(props.node);
          }}
        >
          {t('Show in view')}
        </Button>

        {isTransactionNode(props.node) ? (
          <LinkButton
            size="xs"
            icon={<IconOpen />}
            onClick={() => traceAnalytics.trackViewEventJSON(organization)}
            href={`/api/0/projects/${organization.slug}/${props.node.value.project_slug}/events/${props.node.value.event_id}/json/`}
            external
          >
            {t('JSON')} (<FileSize bytes={props.eventSize ?? 0} />)
          </LinkButton>
        ) : null}
      </Actions>
      <DropdownMenuWithPortal
        items={items}
        className="DropdownMenu"
        position="bottom-end"
        trigger={triggerProps => (
          <ActionsButtonTrigger size="xs" {...triggerProps}>
            {t('Actions')}
            <IconChevron direction="down" size="xs" />
          </ActionsButtonTrigger>
        )}
      />
    </ActionsContainer>
  );
}

const ActionsButtonTrigger = styled(Button)`
  svg {
    margin-left: ${space(0.5)};
    width: 10px;
    height: 10px;
  }
`;

const ActionsContainer = styled('div')`
  display: flex;
  justify-content: end;
  align-items: center;
  gap: ${space(1)};
`;

function EventTags({projectSlug, event}: {event: Event; projectSlug: string}) {
  const hasNewTraceUi = useHasTraceNewUi();

  if (!hasNewTraceUi) {
    return <LegacyEventTags event={event} projectSlug={projectSlug} />;
  }

  return <EventTagsDataSection event={event} projectSlug={projectSlug} />;
}

function LegacyEventTags({projectSlug, event}: {event: Event; projectSlug: string}) {
  return (
    <LazyRender {...TraceDrawerComponents.LAZY_RENDER_PROPS} containerHeight={200}>
      <TagsWrapper>
        <EventTagsDataSection event={event} projectSlug={projectSlug} />
      </TagsWrapper>
    </LazyRender>
  );
}

const TagsWrapper = styled('div')`
  h3 {
    color: ${p => p.theme.textColor};
  }
`;

export type SectionCardKeyValueList = KeyValueListData;

function SectionCard({
  items,
  title,
  disableTruncate,
  sortAlphabetically = false,
  itemProps = {},
}: {
  items: SectionCardKeyValueList;
  title: React.ReactNode;
  disableTruncate?: boolean;
  itemProps?: Partial<KeyValueDataContentProps>;
  sortAlphabetically?: boolean;
}) {
  const contentItems = items.map(item => ({item, ...itemProps}));

  return (
    <CardWrapper>
      <KeyValueData.Card
        title={title}
        contentItems={contentItems}
        sortAlphabetically={sortAlphabetically}
        truncateLength={disableTruncate ? Infinity : 5}
      />
    </CardWrapper>
  );
}

// This is trace-view specific styling. The card is rendered in a number of different places
// with tests failing otherwise, since @container queries are not supported by the version of
// jsdom currently used by jest.
const CardWrapper = styled('div')`
  ${CardPanel} {
    container-type: inline-size;
  }

  ${Subject} {
    @container (width < 350px) {
      max-width: 200px;
    }
  }
`;

function SectionCardGroup({children}: {children: React.ReactNode}) {
  return <KeyValueData.Container>{children}</KeyValueData.Container>;
}

function CopyableCardValueWithLink({
  value,
  linkTarget,
  linkText,
  onClick,
}: {
  value: React.ReactNode;
  linkTarget?: LocationDescriptor;
  linkText?: string;
  onClick?: () => void;
}) {
  return (
    <CardValueContainer>
      <CardValueText>
        {value}
        {typeof value === 'string' ? (
          <StyledCopyToClipboardButton
            borderless
            size="zero"
            iconSize="xs"
            text={value}
          />
        ) : null}
      </CardValueText>
      {linkTarget && linkTarget ? (
        <Link to={linkTarget} onClick={onClick}>
          {linkText}
        </Link>
      ) : null}
    </CardValueContainer>
  );
}

function TraceDataSection({event}: {event: EventTransaction}) {
  const traceData = event.contexts.trace?.data;

  if (!traceData) {
    return null;
  }

  return (
    <SectionCard
      items={Object.entries(traceData).map(([key, value]) => ({
        key,
        subject: key,
        value,
      }))}
      title={t('Trace Data')}
    />
  );
}

const StyledCopyToClipboardButton = styled(CopyToClipboardButton)`
  transform: translateY(2px);
`;

const CardValueContainer = styled(FlexBox)`
  justify-content: space-between;
  gap: ${space(1)};
  flex-wrap: wrap;
`;

const CardValueText = styled('span')`
  overflow-wrap: anywhere;
`;

export const CardContentSubject = styled('div')`
  grid-column: span 1;
  font-family: ${p => p.theme.text.familyMono};
  word-wrap: break-word;
`;

const TraceDrawerComponents = {
  DetailContainer,
  FlexBox,
  Title: TitleWithTestId,
  Type,
  TitleOp,
  HeaderContainer,
  LegacyHeaderContainer,
  Highlights,
  Actions,
  NodeActions,
  Table,
  IconTitleWrapper,
  IconBorder,
  TitleText,
  LegacyTitleText,
  Duration,
  TableRow,
  LAZY_RENDER_PROPS,
  TableRowButtonContainer,
  TableValueRow,
  IssuesLink,
  SectionCard,
  CopyableCardValueWithLink,
  EventTags,
  SubtitleWithCopyButton,
  TraceDataSection,
  SectionCardGroup,
  DropdownMenuWithPortal,
};

export {TraceDrawerComponents};
