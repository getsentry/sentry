import {Fragment, useMemo, useState, type PropsWithChildren} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useHover} from '@react-aria/interactions';

import {Button, LinkButton} from '@sentry/scraps/button';
import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Markdown, markdownRendersVisibleContent} from '@sentry/scraps/markdown';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Separator} from '@sentry/scraps/separator';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ClippedBox} from 'sentry/components/clippedBox';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {EventTagsDataSection} from 'sentry/components/events/eventTagsAndScreenshot/tags';
import {DataSection} from 'sentry/components/events/styles';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {QuestionTooltip} from 'sentry/components/questionTooltip';
import {StructuredData} from 'sentry/components/structuredEventData';
import {getDefaultExpanded} from 'sentry/components/structuredEventData/utils';
import {
  KeyValueTableCard,
  KeyValueTableCardPanel,
  type KeyValueTableDataRowProps,
  KeyValueTableSubject,
  KeyValueTableValueSection,
} from 'sentry/components/tables/keyValueTable';
import {
  IconCircleFill,
  IconFocus,
  IconJson,
  IconPanel,
  IconProfiling,
  IconTerminal,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {KeyValueListData} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useUser} from 'sentry/utils/useUser';
import {getDiscoverDeprecation} from 'sentry/views/discover/utils';
import {getIsAiNode} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {getIsMCPNode} from 'sentry/views/insights/pages/mcp/utils/mcpTraceNodes';
import {traceAnalytics} from 'sentry/views/performance/traceDetails/traceAnalytics';
import {tryParseJsonRecursive} from 'sentry/views/performance/traceDetails/traceDrawer/details/utils';
import {
  makeTraceContinuousProfilingLink,
  makeTransactionProfilingLink,
} from 'sentry/views/performance/traceDetails/traceDrawer/traceProfilingLink';
import {isEAPSpanNode} from 'sentry/views/performance/traceDetails/traceGuards';
import type {BaseNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/baseNode';
import type {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {
  useTraceState,
  useTraceStateDispatch,
} from 'sentry/views/performance/traceDetails/traceState/traceStateProvider';
import {traceGridCssVariables} from 'sentry/views/performance/traceDetails/traceWaterfallStyles';
import {TraceLayoutTabKeys} from 'sentry/views/performance/traceDetails/useTraceLayoutTabs';

import type {DurationComparison} from './durationComparison';
import {
  getDurationComparison,
  makeDurationComparisonStatusColors,
  MIN_PCT_DURATION_DIFFERENCE,
} from './durationComparison';

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
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
`;

const FlexBox = styled('div')`
  display: flex;
  align-items: center;
`;

const Title = styled(FlexBox)`
  gap: ${p => p.theme.space.md};
  flex-grow: 1;
  overflow: hidden;
  > span {
    min-width: 30px;
  }
`;

const LegacyTitleText = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TitleText = styled('div')`
  font-size: ${p => p.theme.font.size.xl};
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
          variant="transparent"
          size="zero"
          text={clipboardText}
          tooltipProps={{disabled: true}}
        />
      ) : null}
    </SubTitleWrapper>
  );
}

const SubTitleWrapper = styled(FlexBox)`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledSubTitleText = styled('span')`
  font-size: ${p => p.theme.font.size.md};
  color: ${p => p.theme.tokens.content.secondary};
`;

const HeaderContainer = styled(FlexBox)`
  align-items: baseline;
  justify-content: space-between;
  gap: ${p => p.theme.space['2xl']};
  margin-bottom: ${p => p.theme.space.md};
`;

type HighlightProps = {
  avgDuration: number | undefined;
  bodyContent: React.ReactNode;
  headerContent: React.ReactNode;
  node: BaseNode;
  project: Project | undefined;
  comparisonDescription?: string;
  footerContent?: React.ReactNode;
  hideNodeActions?: boolean;
  highlightedAttributes?: Array<{name: string; value: React.ReactNode}>;
};

function Highlights({
  node,
  avgDuration,
  project,
  headerContent,
  bodyContent,
  footerContent,
  highlightedAttributes,
  comparisonDescription,
  hideNodeActions,
}: HighlightProps) {
  const location = useLocation();
  const organization = useOrganization();

  const isAiNode = getIsAiNode(node);
  const isMCPNode = getIsMCPNode(node);

  const hidePanelAndBreakdown = isAiNode || isMCPNode;

  const startTimestamp = node.space[0];
  const endTimestamp = node.space[0] + node.space[1];
  const durationInSeconds = (endTimestamp - startTimestamp) / 1e3;

  const comparison = getDurationComparison(
    avgDuration,
    durationInSeconds,
    comparisonDescription
  );

  return (
    <Fragment>
      <HighlightsWrapper>
        <Stack justify="center" align="center" gap="xs">
          <Tooltip title={node.projectSlug}>
            <ProjectBadge
              project={project ? project : {slug: node.projectSlug ?? ''}}
              avatarSize={18}
              hideName
            />
          </Tooltip>
          <Flex flex="1">
            <Separator orientation="vertical" />
          </Flex>
        </Stack>
        <Stack justify="left" flex="1" height="100%" overflow="hidden">
          <HighlightOp>{node.op}</HighlightOp>
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
              {t('Open Agent Activity')}
            </OpenInAIFocusButton>
          )}
          {!hidePanelAndBreakdown && (
            <Fragment>
              <StyledPanel>
                <StyledPanelHeader>{headerContent}</StyledPanelHeader>
                <PanelBody>{bodyContent}</PanelBody>
              </StyledPanel>
              {footerContent}
            </Fragment>
          )}
        </Stack>
      </HighlightsWrapper>
      {/* margin (deprecated) kept for parity with surrounding margin-based sections in BodyContainer */}
      <Separator orientation="horizontal" margin="md 0" border="muted" />
    </Fragment>
  );
}

const StyledPanel = styled(Panel)`
  margin-bottom: 0;
`;

function HighLightEAPOpsBreakdown({node}: {node: EapSpanNode}) {
  const theme = useTheme();
  const breakdown = node.opsBreakdown;
  const dispatch = useTraceStateDispatch();

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
      <Flex wrap="wrap" gap="md">
        {displayOps.map(currOp => {
          const operationName = currOp.op;
          const color = pickBarColor(operationName, theme);
          const pctLabel = Math.round(currOp.percentage);

          return (
            <HighlightsOpRow
              key={operationName}
              onClick={() =>
                dispatch({
                  type: 'set query',
                  query: `op:${operationName}`,
                  source: 'external',
                })
              }
            >
              <StyledIconCircleFill size="xs" fill={color} />
              {operationName}
              <HighlightsOpPct>{pctLabel}%</HighlightsOpPct>
            </HighlightsOpRow>
          );
        })}
      </Flex>
    </HighlightsOpsBreakdownWrapper>
  );
}

const StyledIconCircleFill = styled(IconCircleFill)<{fill: string}>`
  fill: ${p => p.fill};
`;

const HighlightsOpPct = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: 14px;
`;

const HighlightsSpanCount = styled('div')`
  margin-bottom: ${p => p.theme.space['2xs']};
`;

const HighlightsOpRow = styled(FlexBox)`
  font-size: 13px;
  gap: ${p => p.theme.space.xs};
  cursor: pointer;
`;

const HighlightsOpsBreakdownWrapper = styled(FlexBox)`
  align-items: flex-start;
  flex-direction: column;
  gap: ${p => p.theme.space['2xs']};
  margin-top: ${p => p.theme.space.lg};
`;

const HiglightsDurationComparison = styled('div')<
  Pick<NonNullable<DurationComparison>, 'status'>
>`
  white-space: nowrap;
  border-radius: 12px;
  color: ${p => makeDurationComparisonStatusColors(p.theme)[p.status].normal};
  background-color: ${p => makeDurationComparisonStatusColors(p.theme)[p.status].light};
  border: solid 1px ${p => makeDurationComparisonStatusColors(p.theme)[p.status].light};
  font-size: ${p => p.theme.font.size.xs};
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.md};
  display: inline-block;
  height: 21px;
`;

const HighlightsDurationWrapper = styled(FlexBox)`
  gap: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space.md};
`;

const HighlightDuration = styled('div')`
  font-size: ${p => p.theme.font.size.xl};
  font-weight: 400;
`;

const HighlightOp = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.font.size.md};
  line-height: normal;
`;

const HighlightedAttributesWrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  column-gap: ${p => p.theme.space.lg};
  row-gap: ${p => p.theme.space.xs};
  font-size: ${p => p.theme.font.size.md};
  &:not(:last-child) {
    margin-bottom: ${p => p.theme.space.lg};
  }
`;

const HighlightedAttributeName = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
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

const HighlightsWrapper = styled('div')`
  display: flex;
  align-items: stretch;
  gap: ${p => p.theme.space.md};
  width: 100%;
  margin: ${p => p.theme.space.md} 0;
`;

function IssuesLink({
  node,
  children,
  traceSlug: traceSlugProp,
}: {
  children: React.ReactNode;
  node: BaseNode;
  /**
   * Overrides the trace slug used to build the Issues link. The slug is
   * normally read from the `traceSlug` route param, but surfaces that render
   * this outside the trace waterfall route (e.g. the conversations span detail)
   * have no such param and must pass the trace id explicitly.
   */
  traceSlug?: string;
}) {
  const organization = useOrganization();
  const params = useParams<{traceSlug?: string}>();
  const traceSlug = (traceSlugProp || params.traceSlug || '').trim();

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
  node: BaseNode;
  onTabScrollToNode: (node: BaseNode) => void;
  organization: Organization;
  profileId?: string;
  profilerId?: string;
  showJSONLink?: boolean;
  threadId?: string;
}) {
  const organization = useOrganization();
  const user = useUser();
  const params = useParams<{traceSlug?: string}>();

  const transactionId = props.node.transactionId ?? '';

  const canShowEAPSpanJSON =
    getDiscoverDeprecation(props.organization) && isEAPSpanNode(props.node);

  const transactionProfileTarget = useMemo(() => {
    if (!props.profileId) {
      return null;
    }

    return makeTransactionProfilingLink(props.profileId, {
      organization,
      projectSlug: props.node.projectSlug ?? '',
    });
  }, [organization, props.node, props.profileId]);

  const continuousProfileTarget = useMemo(() => {
    if (!props.profilerId) {
      return null;
    }

    return makeTraceContinuousProfilingLink(props.node, props.profilerId, {
      organization,
      projectSlug: props.node.projectSlug ?? '',
      traceId: params.traceSlug ?? '',
      threadId: props.threadId,
    });
  }, [organization, params.traceSlug, props.node, props.profilerId, props.threadId]);

  return (
    <Flex align="center" gap="xs" overflow="visible">
      <Tooltip title={t('Focus in waterfall')} skipWrapper>
        <ActionButton
          onClick={_e => {
            traceAnalytics.trackShowInView(props.organization);
            props.onTabScrollToNode(props.node);
          }}
          size="zero"
          aria-label={t('Focus in waterfall')}
          icon={<IconFocus />}
        />
      </Tooltip>
      {props.showJSONLink && (canShowEAPSpanJSON || transactionId) ? (
        <Tooltip title={t('JSON')} skipWrapper>
          <ActionLinkButton
            onClick={() => traceAnalytics.trackViewEventJSON(props.organization)}
            href={
              canShowEAPSpanJSON
                ? `/api/0/projects/${props.organization.slug}/${props.node.projectSlug}/trace-items/${props.node.id}/?item_type=spans&trace_id=${params.traceSlug}`
                : `/api/0/projects/${props.organization.slug}/${props.node.projectSlug}/events/${transactionId}/json/`
            }
            size="zero"
            aria-label={t('JSON')}
            icon={<IconJson />}
          />
        </Tooltip>
      ) : null}
      {user.isSuperuser && isEAPSpanNode(props.node) && params.traceSlug ? (
        <Tooltip title={t('Span JSON (Superuser Only)')} skipWrapper>
          <ActionLinkButton
            href={`/api/0/projects/${props.organization.slug}/${props.node.projectSlug}/trace-items/${props.node.id}/?item_type=spans&trace_id=${params.traceSlug}&debug=true`}
            size="zero"
            aria-label={t('Span JSON (Superuser Only)')}
            icon={<IconTerminal />}
            external
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
    </Flex>
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

function EventTags({projectSlug, event}: {event: Event; projectSlug: string}) {
  return (
    <EventTagsDataSection
      event={event}
      projectSlug={projectSlug}
      disableCollapsePersistence
    />
  );
}

type SectionCardKeyValueList = KeyValueListData;

const SECTION_CARD_TRUNCATE_LENGTH = 5;

function SectionCard({
  items,
  title,
  sortAlphabetically = false,
  itemProps = {},
}: {
  items: SectionCardKeyValueList;
  title: React.ReactNode;
  itemProps?: Partial<KeyValueTableDataRowProps>;
  sortAlphabetically?: boolean;
}) {
  const contentItems = items.map(item => ({item, ...itemProps}));

  return (
    <CardWrapper>
      <KeyValueTableCard
        title={title}
        contentItems={contentItems}
        sortAlphabetically={sortAlphabetically}
        truncateLength={SECTION_CARD_TRUNCATE_LENGTH}
      />
    </CardWrapper>
  );
}

// This is trace-view specific styling. The card is rendered in a number of different places
// with tests failing otherwise, since @container queries are not supported by the version of
// jsdom currently used by jest.
const CardWrapper = styled('div')`
  ${KeyValueTableCardPanel} {
    container-type: inline-size;
  }

  ${KeyValueTableSubject} {
    display: flex;
    align-items: center;
    @container (width < 350px) {
      max-width: 200px;
    }
  }

  ${KeyValueTableValueSection} {
    align-items: center;
  }
`;

function MultilineText({
  children,
  renderFormatted,
  clip = true,
}: {
  children: string;
  /**
   * Clips tall content behind a "Show More" button. Disable when the container
   * scrolls on its own, so content flows instead of being clipped and hidden.
   */
  clip?: boolean;
  renderFormatted?: (text: string) => React.ReactNode;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const {hoverProps, isHovered} = useHover({});
  const theme = useTheme();

  // Without a custom formatter we render `children` as markdown, but some
  // markdown (e.g. a bare/empty ``` fence) renders to nothing — leaving the
  // "Pretty" view blank. Fall back to the raw text in that case. See TET-2670.
  const defaultFormattingIsBlank = useMemo(
    () => !renderFormatted && !markdownRendersVisibleContent(children),
    [renderFormatted, children]
  );

  const content = (
    <MultilineTextWrapper {...hoverProps}>
      <Container position="absolute" top={theme.space.xs} right={theme.space.xs}>
        {isHovered && (
          <SegmentedControl
            size="xs"
            value={showRaw ? 'raw' : 'formatted'}
            onChange={value => setShowRaw(value === 'raw')}
          >
            <SegmentedControl.Item key="formatted">{t('Pretty')}</SegmentedControl.Item>
            <SegmentedControl.Item key="raw">{t('Raw')}</SegmentedControl.Item>
          </SegmentedControl>
        )}
      </Container>
      {showRaw || defaultFormattingIsBlank
        ? children.trim()
        : (renderFormatted?.(children) ?? <Markdown raw={children} />)}
    </MultilineTextWrapper>
  );

  if (!clip) {
    return content;
  }

  return (
    <StyledClippedBox clipHeight={150} buttonProps={{variant: 'secondary', size: 'xs'}}>
      {content}
    </StyledClippedBox>
  );
}

const StyledClippedBox = styled(ClippedBox)`
  padding: 0;
  margin-bottom: ${p => p.theme.space.md};
`;

const MultilineTextWrapper = styled('div')`
  position: relative;
  white-space: pre-wrap;
  background-color: ${p => p.theme.tokens.background.secondary};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space.md};
  word-break: break-word;
  &:not(:last-child) {
    margin-bottom: ${p => p.theme.space.md};
  }

  /* word-break: break-word is legacy for overflow-wrap: anywhere, which counts
   * toward min-content intrinsic size. Inherited into cells, it collapses them to
   * about one character: the table then fits any container, columns squish, and
   * its scroll container never overflows. Tables scroll on their own. */
  table {
    word-break: normal;
  }
`;

function MultilineJSON({
  value,
  maxDefaultDepth = 2,
  autoCollapseLimit,
  clip = false,
}: {
  value: any;
  autoCollapseLimit?: number;
  /**
   * Clips tall content behind a "Show More" button. Disable when the container
   * scrolls on its own, so content flows instead of being clipped and hidden.
   */
  clip?: boolean;
  maxDefaultDepth?: number;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const {hoverProps, isHovered} = useHover({});
  const theme = useTheme();

  const json = useMemo(() => tryParseJsonRecursive(value), [value]);

  // Ensure root ('$') is always expanded, while children follow maxDefaultDepth rules
  const computedExpandedPaths = useMemo(() => {
    const childPaths = getDefaultExpanded(maxDefaultDepth, json, autoCollapseLimit);
    return Array.from(new Set(['$', ...childPaths]));
  }, [maxDefaultDepth, json, autoCollapseLimit]);

  const content = (
    <MultilineTextWrapperMonospace {...hoverProps}>
      {isHovered && (
        <Container
          position="absolute"
          top={theme.space.xs}
          right={theme.space.xs}
          style={{
            // Ensure the segmented control is on top of the text StructuredData
            zIndex: 1,
          }}
        >
          <SegmentedControl
            size="xs"
            value={showRaw ? 'raw' : 'formatted'}
            onChange={v => setShowRaw(v === 'raw')}
          >
            <SegmentedControl.Item key="formatted">{t('Pretty')}</SegmentedControl.Item>
            <SegmentedControl.Item key="raw">{t('Raw')}</SegmentedControl.Item>
          </SegmentedControl>
        </Container>
      )}
      {showRaw ? (
        <pre>
          <code>{JSON.stringify(json, null, 2)}</code>
        </pre>
      ) : (
        <StructuredData
          config={{
            isString: v => typeof v === 'string',
            isBoolean: v => typeof v === 'boolean',
            isNumber: v => typeof v === 'number',
          }}
          value={json}
          maxDefaultDepth={maxDefaultDepth}
          autoCollapseLimit={autoCollapseLimit}
          initialExpandedPaths={computedExpandedPaths}
          withAnnotatedText
        />
      )}
    </MultilineTextWrapperMonospace>
  );

  if (!clip) {
    return content;
  }

  return (
    <StyledClippedBox clipHeight={150} buttonProps={{variant: 'secondary', size: 'xs'}}>
      {content}
    </StyledClippedBox>
  );
}

const MultilineTextWrapperMonospace = styled(MultilineTextWrapper)`
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  /* Reserve vertical space for the hoverable Pretty/Raw segmented control (form height + top/bottom spacing) */
  min-height: calc(${p => p.theme.form.xs.height} + (${p => p.theme.space.xs} * 2));
  /* Reserve horizontal space so the absolutely-positioned Pretty/Raw control doesn't
   * overlap the content when the object is narrow (e.g. inside a fit-content bubble). */
  min-width: 210px;
  pre {
    margin: 0;
    padding: 0;
    font-size: ${p => p.theme.font.size.sm};
  }
`;

const MultilineTextLabel = styled('div')`
  font-weight: bold;
  margin-bottom: ${p => p.theme.space.md};
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
  Title: TitleWithTestId,
  HeaderContainer,
  Highlights,
  HighLightEAPOpsBreakdown,
  NodeActions,
  SectionTitleWithQuestionTooltip,
  TitleText,
  LegacyTitleText,
  IssuesLink,
  SectionCard,
  EventTags,
  SubtitleWithCopyButton,
  MultilineText,
  MultilineJSON,
  MultilineTextLabel,
};
