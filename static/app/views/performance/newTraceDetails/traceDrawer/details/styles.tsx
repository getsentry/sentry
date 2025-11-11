import {Fragment, useCallback, useMemo, useState, type PropsWithChildren} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {
  DropdownMenu,
  type DropdownMenuProps,
  type MenuItemProps,
} from 'sentry/components/dropdownMenu';
import {EventTagsDataSection} from 'sentry/components/events/eventTagsAndScreenshot/tags';
import {generateStats} from 'sentry/components/events/opsBreakdown';
import {DataSection} from 'sentry/components/events/styles';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {
  CardPanel,
  KeyValueData,
  Subject,
  ValueSection,
  type KeyValueDataContentProps,
} from 'sentry/components/keyValueData';
import {type LazyRenderProps} from 'sentry/components/lazyRender';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {StructuredData} from 'sentry/components/structuredEventData';
import {
  IconCircleFill,
  IconEllipsis,
  IconFocus,
  IconJson,
  IconPanel,
  IconProfiling,
} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, EventTransaction} from 'sentry/types/event';
import type {KeyValueListData} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import getDuration from 'sentry/utils/duration/getDuration';
import {ellipsize} from 'sentry/utils/string/ellipsize';
import type {Color, ColorOrAlias} from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {getIsAiNode} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {getIsMCPNode} from 'sentry/views/insights/pages/mcp/utils/mcpTraceNodes';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import {useTransaction} from 'sentry/views/performance/newTraceDetails/traceApi/useTransaction';
import {useDrawerContainerRef} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/drawerContainerRefContext';
import {
  makeTraceContinuousProfilingLink,
  makeTransactionProfilingLink,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/traceProfilingLink';
import {
  isEAPSpanNode,
  isEAPTransactionNode,
  isSpanNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {MissingInstrumentationNode} from 'sentry/views/performance/newTraceDetails/traceModels/missingInstrumentationNode';
import type {ParentAutogroupNode} from 'sentry/views/performance/newTraceDetails/traceModels/parentAutogroupNode';
import type {SiblingAutogroupNode} from 'sentry/views/performance/newTraceDetails/traceModels/siblingAutogroupNode';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {
  useTraceState,
  useTraceStateDispatch,
} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';
import {traceGridCssVariables} from 'sentry/views/performance/newTraceDetails/traceWaterfallStyles';
import {TraceLayoutTabKeys} from 'sentry/views/performance/newTraceDetails/useTraceLayoutTabs';

import type {KeyValueActionParams, TraceDrawerActionKind} from './utils';
import {getTraceKeyValueActions, TraceDrawerActionValueKind} from './utils';

const BodyContainer = styled('div')`
  display: flex;
  flex-direction: column;
  height: calc(100% - 52px);
  overflow-y: auto;
  overflow-x: hidden;

  ${DataSection} {
    padding: 0;
  }
`;

const DetailContainer = styled('div')`
  ${traceGridCssVariables}
  height: 100%;
  overflow: hidden;
  padding: ${space(1)} ${space(2)};
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
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: bold;
`;

function TitleWithTestId(props: PropsWithChildren) {
  return <Title data-test-id="trace-drawer-title">{props.children}</Title>;
}

function SubtitleWithCopyButton({
  subTitle,
  clipboardText,
}: {
  clipboardText: string;
  subTitle: string;
}) {
  return (
    <SubTitleWrapper>
      <StyledSubTitleText>{subTitle}</StyledSubTitleText>
      {clipboardText ? (
        <CopyToClipboardButton
          aria-label={t('Copy to clipboard')}
          borderless
          size="zero"
          text={clipboardText}
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
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};
`;

function TitleOp({text}: {text: string}) {
  return (
    <Tooltip
      title={
        <Fragment>
          {text}
          <CopyToClipboardButton
            aria-label={t('Copy to clipboard')}
            borderless
            size="zero"
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
  font-size: ${p => p.theme.fontSize.sm};
`;

const TitleOpText = styled('div')`
  font-size: 15px;
  font-weight: ${p => p.theme.fontWeight.bold};
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
  margin: ${space(1)};
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
  margin-bottom: ${space(1)};
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
  deltaText: React.JSX.Element;
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
  title: React.JSX.Element | string | null;
  extra?: React.ReactNode;
  keep?: boolean;
  prefix?: React.JSX.Element;
  toolTipText?: string;
}) {
  if (!keep && !children) {
    return null;
  }

  return (
    <tr>
      <td className="key">
        <Flex align="center">
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
  hideNodeActions?: boolean;
  highlightedAttributes?: Array<{name: string; value: React.ReactNode}>;
};

function Highlights({
  node,
  transaction: event,
  avgDuration,
  project,
  headerContent,
  bodyContent,
  highlightedAttributes,
  hideNodeActions,
}: HighlightProps) {
  const location = useLocation();
  const dispatch = useTraceStateDispatch();
  const organization = useOrganization();

  const onOpsBreakdownRowClick = useCallback(
    (op: string) => {
      dispatch({type: 'set query', query: `op:${op}`, source: 'external'});
    },
    [dispatch]
  );

  if (!isTransactionNode(node) && !isSpanNode(node) && !isEAPSpanNode(node)) {
    return null;
  }

  const isAiNode = getIsAiNode(node);
  const isMCPNode = getIsMCPNode(node);

  const hidePanelAndBreakdown = isAiNode || isMCPNode;

  const startTimestamp = node.space[0];
  const endTimestamp = node.space[0] + node.space[1];
  const durationInSeconds = (endTimestamp - startTimestamp) / 1e3;

  const baseDescription = isTransactionNode(node)
    ? t('Average duration for this transaction over the last 24 hours')
    : t('Average duration for this span over the last 24 hours');
  const comparison = getDurationComparison(
    avgDuration,
    durationInSeconds,
    baseDescription
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
          {highlightedAttributes && highlightedAttributes.length > 0 ? (
            <HighlightedAttributesWrapper>
              {highlightedAttributes.map(({name, value}) => (
                <Fragment key={name}>
                  <HighlightedAttributeName>{name}</HighlightedAttributeName>
                  <div>{value}</div>
                </Fragment>
              ))}
            </HighlightedAttributesWrapper>
          ) : null}
          {isAiNode && !hideNodeActions && (
            <OpenInAIFocusButton
              size="xs"
              onClick={() => {
                trackAnalytics('agent-monitoring.view-ai-trace-click', {
                  organization,
                });
              }}
              to={{
                ...location,
                query: {
                  ...location.query,
                  tab: TraceLayoutTabKeys.AI_SPANS,
                },
              }}
            >
              {t('Open in AI View')}
            </OpenInAIFocusButton>
          )}
          {!hidePanelAndBreakdown && (
            <Fragment>
              <StyledPanel>
                <StyledPanelHeader>{headerContent}</StyledPanelHeader>
                <PanelBody>{bodyContent}</PanelBody>
              </StyledPanel>
              {isEAPSpanNode(node) ? (
                <HighLightEAPOpsBreakdown
                  onRowClick={onOpsBreakdownRowClick}
                  node={node}
                />
              ) : event ? (
                <HighLightsOpsBreakdown
                  onRowClick={onOpsBreakdownRowClick}
                  event={event}
                />
              ) : null}
            </Fragment>
          )}
        </HighlightsRightColumn>
      </HighlightsWrapper>
      <SectionDivider />
    </Fragment>
  );
}

const StyledPanel = styled(Panel)`
  margin-bottom: 0;
`;

function HighLightsOpsBreakdown({
  event,
  onRowClick,
}: {
  event: EventTransaction;
  onRowClick: (op: string) => void;
}) {
  const theme = useTheme();
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
          const color = pickBarColor(operationName, theme);
          const pctLabel = isFinite(percentage) ? Math.round(percentage * 100) : '∞';

          return (
            <HighlightsOpRow
              key={operationName}
              onClick={() => onRowClick(operationName)}
            >
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

function HighLightEAPOpsBreakdown({
  node,
  onRowClick,
}: {
  node: TraceTreeNode<TraceTree.EAPSpan>;
  onRowClick: (op: string) => void;
}) {
  const theme = useTheme();
  const breakdown = node.eapSpanOpsBreakdown;

  if (breakdown.length === 0) {
    return null;
  }

  const sortedBreakdown = breakdown.toSorted((a, b) => b.count - a.count);
  const totalCount = sortedBreakdown.reduce((acc, curr) => acc + curr.count, 0);

  const TOP_N = 3;
  const displayOps = sortedBreakdown.slice(0, TOP_N).map(op => ({
    op: op.op,
    percentage: (op.count / totalCount) * 100,
  }));

  if (sortedBreakdown.length > TOP_N) {
    const topNPercentage = displayOps.reduce((acc, curr) => acc + curr.percentage, 0);
    displayOps.push({
      op: t('Other'),
      percentage: 100 - topNPercentage,
    });
  }

  return (
    <HighlightsOpsBreakdownWrapper>
      <HighlightsSpanCount>{t('Most frequent child span ops are:')}</HighlightsSpanCount>
      <TopOpsList>
        {displayOps.map(currOp => {
          const operationName = currOp.op;
          const color = pickBarColor(operationName, theme);
          const pctLabel = Math.round(currOp.percentage);

          return (
            <HighlightsOpRow
              key={operationName}
              onClick={() => onRowClick(operationName)}
            >
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
  flex-wrap: wrap;
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
  cursor: pointer;
`;

const HighlightsOpsBreakdownWrapper = styled(FlexBox)`
  align-items: flex-start;
  flex-direction: column;
  gap: ${space(0.25)};
  margin-top: ${space(1.5)};
`;

const HiglightsDurationComparison = styled('div')<
  Pick<NonNullable<DurationComparison>, 'status'>
>`
  white-space: nowrap;
  border-radius: 12px;
  color: ${p => p.theme[DURATION_COMPARISON_STATUS_COLORS[p.status].normal]};
  background-color: ${p => p.theme[DURATION_COMPARISON_STATUS_COLORS[p.status].light]};
  border: solid 1px ${p => p.theme[DURATION_COMPARISON_STATUS_COLORS[p.status].light]};
  font-size: ${p => p.theme.fontSize.xs};
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
  font-size: ${p => p.theme.fontSize.md};
  line-height: normal;
`;

const HighlightedAttributesWrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  column-gap: ${space(1.5)};
  row-gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSize.md};
  &:not(:last-child) {
    margin-bottom: ${space(1.5)};
  }
`;

const HighlightedAttributeName = styled('div')`
  color: ${p => p.theme.subText};
`;

const OpenInAIFocusButton = styled(LinkButton)`
  width: max-content;
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
  margin: ${space(1)} 0;
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
  font-weight: ${p => p.theme.fontWeight.bold};
  margin-right: ${space(1)};
`;

const Comparison = styled('span')<{status: 'faster' | 'slower' | 'equal'}>`
  color: ${p => p.theme[DURATION_COMPARISON_STATUS_COLORS[p.status].normal]};
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

function KeyValueAction({
  rowKey,
  rowValue,
  projectIds,
  kind = TraceDrawerActionValueKind.SENTRY_TAG,
}: Pick<KeyValueActionParams, 'rowKey' | 'rowValue' | 'kind' | 'projectIds'>) {
  const location = useLocation();
  const organization = useOrganization();
  const [isVisible, setIsVisible] = useState(false);
  const dropdownOptions = getTraceKeyValueActions({
    rowKey,
    rowValue,
    kind,
    projectIds,
    location,
    organization,
  });

  if (dropdownOptions.length === 0 || !rowValue || !rowKey) {
    return null;
  }

  return (
    <KeyValueActionDropdown
      preventOverflowOptions={{padding: 4}}
      className={isVisible ? '' : 'invisible'}
      position="bottom-end"
      size="xs"
      onOpenChange={isOpen => setIsVisible(isOpen)}
      triggerProps={{
        'aria-label': t('Key Value Action Menu'),
        icon: <IconEllipsis />,
        showChevron: false,
        className: 'trigger-button',
      }}
      onAction={key => {
        traceAnalytics.trackExploreSearch(
          organization,
          rowKey,
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          rowValue.toString(),
          key as TraceDrawerActionKind,
          'drawer'
        );
      }}
      items={dropdownOptions}
    />
  );
}

const KeyValueActionDropdown = styled(DropdownMenu)`
  display: block;
  margin: 1px;
  height: 20px;
  .trigger-button {
    height: 20px;
    min-height: 20px;
    padding: 0 ${space(0.75)};
    border-radius: ${space(0.5)};
    z-index: 1;
  }
`;

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
      leadingItems: <IconPanel direction="left" />,
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
      leadingItems: <IconPanel direction="right" />,
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
      leadingItems: <IconPanel direction="down" />,
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
            size="zero"
            aria-label={t('Panel position')}
            icon={<IconPanel direction="right" />}
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
  const organization = useOrganization();
  const params = useParams<{traceSlug?: string}>();

  const transactionId = isTransactionNode(props.node)
    ? props.node.value.event_id
    : isEAPTransactionNode(props.node)
      ? props.node.value.transaction_id
      : '';

  const {data: transaction} = useTransaction({
    event_id: transactionId,
    project_slug: props.node.value.project_slug,
    organization,
  });

  const transactionProfileTarget = useMemo(() => {
    const profileId = isTransactionNode(props.node)
      ? props.node.value.profile_id
      : isSpanNode(props.node)
        ? (props.node.event?.contexts?.profile?.profile_id ?? '')
        : '';
    if (!profileId) {
      return null;
    }
    return makeTransactionProfilingLink(profileId, {
      organization,
      projectSlug: props.node.metadata.project_slug ?? '',
    });
  }, [organization, props.node]);

  const continuousProfileTarget = useMemo(() => {
    const profilerId = isTransactionNode(props.node)
      ? props.node.value.profiler_id
      : isSpanNode(props.node)
        ? (props.node.value.sentry_tags?.profiler_id ?? null)
        : null;
    if (!profilerId) {
      return null;
    }
    return makeTraceContinuousProfilingLink(props.node, profilerId, {
      organization,
      projectSlug: props.node.metadata.project_slug ?? '',
      traceId: params.traceSlug ?? '',
      threadId: getThreadIdFromNode(props.node, transaction),
    });
  }, [organization, params.traceSlug, props.node, transaction]);

  return (
    <ActionWrapper>
      <Tooltip title={t('Show in view')} skipWrapper>
        <ActionButton
          onClick={_e => {
            traceAnalytics.trackShowInView(props.organization);
            props.onTabScrollToNode(props.node);
          }}
          size="zero"
          aria-label={t('Show in view')}
          icon={<IconFocus />}
        />
      </Tooltip>
      {transactionId &&
      (isTransactionNode(props.node) || isEAPTransactionNode(props.node)) ? (
        <Tooltip title={t('JSON')} skipWrapper>
          <ActionLinkButton
            onClick={() => traceAnalytics.trackViewEventJSON(props.organization)}
            href={`/api/0/projects/${props.organization.slug}/${props.node.value.project_slug}/events/${transactionId}/json/`}
            size="zero"
            aria-label={t('JSON')}
            icon={<IconJson />}
          />
        </Tooltip>
      ) : null}
      {continuousProfileTarget ? (
        <Tooltip title={t('Profile')} skipWrapper>
          <ActionLinkButton
            onClick={() => traceAnalytics.trackViewContinuousProfile(props.organization)}
            to={continuousProfileTarget}
            size="zero"
            aria-label={t('Profile')}
            icon={<IconProfiling />}
          />
        </Tooltip>
      ) : transactionProfileTarget ? (
        <Tooltip title={t('Profile')} skipWrapper>
          <ActionLinkButton
            onClick={() => traceAnalytics.trackViewTransactionProfile(props.organization)}
            to={transactionProfileTarget}
            size="zero"
            aria-label={t('Profile')}
            icon={<IconProfiling />}
          />
        </Tooltip>
      ) : null}
      <PanelPositionDropDown organization={organization} />
    </ActionWrapper>
  );
}

const actionButtonStyles = css`
  border: none;
  background-color: transparent;
  box-shadow: none;
  transition: none !important;
  opacity: 0.8;
  height: 24px;
  width: 24px;
  max-height: 24px;

  &:hover {
    border: none;
    background-color: transparent;
    box-shadow: none;
    opacity: 1;
  }
`;

const ActionButton = styled(Button)`
  ${actionButtonStyles};
`;

const ActionLinkButton = styled(LinkButton)`
  ${actionButtonStyles};
`;

const ActionWrapper = styled('div')`
  overflow: visible;
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

function EventTags({projectSlug, event}: {event: Event; projectSlug: string}) {
  return (
    <EventTagsDataSection
      event={event}
      projectSlug={projectSlug}
      disableCollapsePersistence
    />
  );
}

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
    display: flex;
    align-items: center;
    @container (width < 350px) {
      max-width: 200px;
    }
  }

  ${ValueSection} {
    align-items: center;
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
            text={value}
            aria-label={t('Copy to clipboard')}
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

const MAX_TEXT_LENGTH = 300;
const MAX_NEWLINES = 5;

function MultilineText({children}: {children: string}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const newLineMatches = Array.from(children.matchAll(/\n/g));
  const maxNewlinePosition = newLineMatches.at(MAX_NEWLINES - 1)?.index ?? Infinity;

  const truncatePosition = Math.min(maxNewlinePosition, MAX_TEXT_LENGTH);
  const needsTruncation = truncatePosition < children.length;

  return (
    <MultilineTextWrapper>
      {isExpanded || !needsTruncation ? (
        children
      ) : (
        <Fragment>{ellipsize(children, truncatePosition)}</Fragment>
      )}
      {needsTruncation ? (
        <Flex justify="center" paddingTop="md">
          <Button size="xs" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? t('Show less') : t('Show all')}
          </Button>
        </Flex>
      ) : null}
    </MultilineTextWrapper>
  );
}

const MultilineTextWrapper = styled('div')`
  white-space: pre-wrap;
  background-color: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)};
  word-break: break-word;
  &:not(:last-child) {
    margin-bottom: ${space(1.5)};
  }
`;

function tryParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
}

function MultilineJSON({
  value,
  maxDefaultDepth = 2,
}: {
  value: any;
  maxDefaultDepth?: number;
}) {
  const json = tryParseJson(value);
  return (
    <MultilineTextWrapperMonospace>
      <StructuredData
        config={{
          isString: v => typeof v === 'string',
          isBoolean: v => typeof v === 'boolean',
          isNumber: v => typeof v === 'number',
        }}
        value={json}
        maxDefaultDepth={maxDefaultDepth}
        withAnnotatedText
      />
    </MultilineTextWrapperMonospace>
  );
}

const MultilineTextWrapperMonospace = styled(MultilineTextWrapper)`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.codeFontSize};
`;

const MultilineTextLabel = styled('div')`
  font-weight: bold;
  margin-bottom: ${space(1)};
`;

function SectionTitleWithQuestionTooltip({
  title,
  tooltipText,
}: {
  title: string;
  tooltipText: string;
}) {
  return (
    <Flex gap="xs" align="center">
      <div>{title}</div>
      <QuestionTooltip title={tooltipText} size="sm" />
    </Flex>
  );
}

export const TraceDrawerComponents = {
  DetailContainer,
  BodyContainer,
  FlexBox,
  Title: TitleWithTestId,
  Type,
  TitleOp,
  HeaderContainer,
  LegacyHeaderContainer,
  Highlights,
  Actions,
  NodeActions,
  KeyValueAction,
  Table,
  SectionTitleWithQuestionTooltip,
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
  MultilineText,
  MultilineJSON,
  MultilineTextLabel,
};
