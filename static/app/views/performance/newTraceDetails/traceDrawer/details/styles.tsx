import {
  Children,
  Fragment,
  type PropsWithChildren,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';
import startCase from 'lodash/startCase';
import * as qs from 'query-string';

import {Button} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {useIssueDetailsColumnCount} from 'sentry/components/events/eventTags/util';
import {DataSection} from 'sentry/components/events/styles';
import FileSize from 'sentry/components/fileSize';
import type {LazyRenderProps} from 'sentry/components/lazyRender';
import Link from 'sentry/components/links/link';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Panel from 'sentry/components/panels/panel';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {StructuredData} from 'sentry/components/structuredEventData';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron, IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {KeyValueListDataItem} from 'sentry/types';
import type {Organization} from 'sentry/types/organization';
import {defined, formatBytesBase10} from 'sentry/utils';
import getDuration from 'sentry/utils/duration/getDuration';
import {decodeScalar} from 'sentry/utils/queryString';
import type {ColorOrAlias} from 'sentry/utils/theme';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  isAutogroupedNode,
  isMissingInstrumentationNode,
  isNoDataNode,
  isRootNode,
  isSpanNode,
  isTraceErrorNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/guards';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import type {
  MissingInstrumentationNode,
  NoDataNode,
  ParentAutogroupNode,
  SiblingAutogroupNode,
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

const DetailContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  padding: ${space(1)};

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
  flex-wrap: wrap;
  justify-content: end;
  width: 100%;
`;

const Title = styled(FlexBox)`
  gap: ${space(1)};
  width: 50%;
  > span {
    min-width: 30px;
  }
`;

const TitleText = styled('div')`
  ${p => p.theme.overflowEllipsis}
`;

function TitleWithTestId(props: PropsWithChildren<{}>) {
  return <Title data-test-id="trace-drawer-title">{props.children}</Title>;
}

const Type = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
`;

const TitleOp = styled('div')`
  font-size: 15px;
  font-weight: bold;
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

const HeaderContainer = styled(Title)`
  justify-content: space-between;
  width: 100%;
  z-index: 10;
  flex: 1 1 auto;
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

type DurationProps = {
  baseline: number | undefined;
  duration: number;
  baseDescription?: string;
  ratio?: number;
};

function Duration(props: DurationProps) {
  if (typeof props.duration !== 'number' || Number.isNaN(props.duration)) {
    return <DurationContainer>{t('unknown')}</DurationContainer>;
  }

  if (props.baseline === undefined || props.baseline === 0) {
    return <DurationContainer>{getDuration(props.duration, 2, true)}</DurationContainer>;
  }

  const delta = props.duration - props.baseline;
  const deltaPct = Math.round(Math.abs((delta / props.baseline) * 100));
  const status = delta > 0 ? 'slower' : delta < 0 ? 'faster' : 'equal';

  const formattedBaseDuration = (
    <Tooltip
      title={props.baseDescription}
      showUnderline
      underlineColor={DURATION_COMPARISON_STATUS_COLORS[status].normal}
    >
      {getDuration(props.baseline, 2, true)}
    </Tooltip>
  );

  const deltaText =
    status === 'equal'
      ? tct(`equal to the avg of [formattedBaseDuration]`, {
          formattedBaseDuration,
        })
      : status === 'faster'
        ? tct(`[deltaPct] faster than the avg of [formattedBaseDuration]`, {
            formattedBaseDuration,
            deltaPct: `${deltaPct}%`,
          })
        : tct(`[deltaPct] slower than the avg of [formattedBaseDuration]`, {
            formattedBaseDuration,
            deltaPct: `${deltaPct}%`,
          });

  return (
    <Fragment>
      <DurationContainer>
        {getDuration(props.duration, 2, true)}{' '}
        {props.ratio ? `(${(props.ratio * 100).toFixed()}%)` : null}
      </DurationContainer>
      {deltaPct >= MIN_PCT_DURATION_DIFFERENCE ? (
        <Comparison status={status}>{deltaText}</Comparison>
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

function getSearchParamFromNode(node: TraceTreeNode<TraceTree.NodeValue>) {
  if (isTransactionNode(node) || isTraceErrorNode(node)) {
    return `id:${node.value.event_id}`;
  }

  // Issues associated to a span or autogrouped node are not queryable, so we query by
  // the parent transaction's id
  const parentTransaction = node.parent_transaction;
  if ((isSpanNode(node) || isAutogroupedNode(node)) && parentTransaction) {
    return `id:${parentTransaction.value.event_id}`;
  }

  if (isMissingInstrumentationNode(node)) {
    throw new Error('Missing instrumentation nodes do not have associated issues');
  }

  return '';
}

function IssuesLink({
  node,
  children,
}: {
  children: React.ReactNode;
  node?: TraceTreeNode<TraceTree.NodeValue>;
}) {
  const organization = useOrganization();
  const params = useParams<{traceSlug?: string}>();
  const traceSlug = params.traceSlug?.trim() ?? '';

  const dateSelection = useMemo(() => {
    const normalizedParams = normalizeDateTimeParams(qs.parse(window.location.search), {
      allowAbsolutePageDatetime: true,
    });
    const start = decodeScalar(normalizedParams.start);
    const end = decodeScalar(normalizedParams.end);
    const statsPeriod = decodeScalar(normalizedParams.statsPeriod);

    return {start, end, statsPeriod};
  }, []);

  return (
    <Link
      to={{
        pathname: `/organizations/${organization.slug}/issues/`,
        query: {
          query: `trace:${traceSlug} ${node ? getSearchParamFromNode(node) : ''}`,
          start: dateSelection.start,
          end: dateSelection.end,
          statsPeriod: dateSelection.statsPeriod,
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
  font-weight: bold;
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

function NodeActions(props: {
  node: TraceTreeNode<any>;
  onTabScrollToNode: (
    node:
      | TraceTreeNode<any>
      | ParentAutogroupNode
      | SiblingAutogroupNode
      | NoDataNode
      | MissingInstrumentationNode
  ) => void;
  organization: Organization;
  eventSize?: number | undefined;
}) {
  const items = useMemo(() => {
    const showInView: MenuItemProps = {
      key: 'show-in-view',
      label: t('Show in View'),
      onAction: () => {
        traceAnalytics.trackShowInView(props.organization);
        props.onTabScrollToNode(props.node);
      },
    };

    const eventId =
      props.node.metadata.event_id ?? props.node.parent_transaction?.metadata.event_id;
    const projectSlug =
      props.node.metadata.project_slug ??
      props.node.parent_transaction?.metadata.project_slug;

    const eventSize = props.eventSize;
    const jsonDetails: MenuItemProps = {
      key: 'json-details',
      onAction: () => {
        traceAnalytics.trackViewEventJSON(props.organization);
        window.open(
          `/api/0/projects/${props.organization.slug}/${projectSlug}/events/${eventId}/json/`,
          '_blank'
        );
      },
      label:
        t('JSON') +
        (typeof eventSize === 'number' ? ` (${formatBytesBase10(eventSize, 0)})` : ''),
    };

    if (isTransactionNode(props.node)) {
      return [showInView, jsonDetails];
    }
    if (isSpanNode(props.node)) {
      return [showInView];
    }
    if (isMissingInstrumentationNode(props.node)) {
      return [showInView];
    }
    if (isTraceErrorNode(props.node)) {
      return [showInView];
    }
    if (isRootNode(props.node)) {
      return [showInView];
    }
    if (isAutogroupedNode(props.node)) {
      return [showInView];
    }
    if (isNoDataNode(props.node)) {
      return [showInView];
    }

    return [showInView];
  }, [props]);

  return (
    <ActionsContainer>
      <Actions className="Actions">
        <Button
          size="xs"
          onClick={_e => {
            traceAnalytics.trackShowInView(props.organization);
            props.onTabScrollToNode(props.node);
          }}
        >
          {t('Show in view')}
        </Button>

        {isTransactionNode(props.node) ? (
          <Button
            size="xs"
            icon={<IconOpen />}
            onClick={() => traceAnalytics.trackViewEventJSON(props.organization)}
            href={`/api/0/projects/${props.organization.slug}/${props.node.value.project_slug}/events/${props.node.value.event_id}/json/`}
            external
          >
            {t('JSON')} (<FileSize bytes={props.eventSize ?? 0} />)
          </Button>
        ) : null}
      </Actions>
      <DropdownMenu
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
  container-type: inline-size;
  min-width: 24px;
  width: 100%;

  @container (max-width: 380px) {
    .DropdownMenu {
      display: block;
    }
    .Actions {
      display: none;
    }
  }

  @container (min-width: 381px) {
    .DropdownMenu {
      display: none;
    }
  }
`;

interface SectionCardContentConfig {
  disableErrors?: boolean;
  includeAliasInSubject?: boolean;
}

type SectionCardKeyValue = Omit<KeyValueListDataItem, 'subject'> & {
  subject: React.ReactNode;
};

export type SectionCardKeyValueList = SectionCardKeyValue[];

interface SectionCardContentProps {
  item: SectionCardKeyValue;
  meta: Record<string, any>;
  alias?: string;
  config?: SectionCardContentConfig;
}

function SectionCardContent({
  item,
  alias,
  meta,
  config,
  ...props
}: SectionCardContentProps) {
  const {key, subject, value, action = {}} = item;
  if (key === 'type') {
    return null;
  }

  const dataComponent = (
    <StructuredData
      value={value}
      depth={0}
      maxDefaultDepth={0}
      meta={meta?.[key]}
      withAnnotatedText
      withOnlyFormattedText
    />
  );

  const contextSubject = subject
    ? config?.includeAliasInSubject && alias
      ? `${startCase(alias)}: ${subject}`
      : subject
    : null;

  return (
    <ContentContainer {...props}>
      {contextSubject ? <CardContentSubject>{contextSubject}</CardContentSubject> : null}
      <CardContentValueWrapper hasSubject={!!contextSubject} className="ctx-row-value">
        {defined(action?.link) ? (
          <Link to={action.link}>{dataComponent}</Link>
        ) : (
          dataComponent
        )}
      </CardContentValueWrapper>
    </ContentContainer>
  );
}

function SectionCard({
  items,
  title,
  disableTruncate,
}: {
  items: SectionCardKeyValueList;
  title: React.ReactNode;
  disableTruncate?: boolean;
}) {
  const [showingAll, setShowingAll] = useState(disableTruncate ?? false);
  const renderText = showingAll ? t('Show less') : t('Show more') + '...';

  if (items.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContentTitle>{title}</CardContentTitle>
      {items.slice(0, showingAll ? items.length : 5).map(item => (
        <SectionCardContent key={`context-card-${item.key}`} meta={{}} item={item} />
      ))}
      {items.length > 5 && !disableTruncate ? (
        <TruncateActionWrapper>
          <a onClick={() => setShowingAll(prev => !prev)}>{renderText}</a>
        </TruncateActionWrapper>
      ) : null}
    </Card>
  );
}

function SectionCardGroup({children}: {children: React.ReactNode}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useIssueDetailsColumnCount(containerRef);

  const columns: React.ReactNode[] = [];
  const cards = Children.toArray(children);

  // Evenly distributing the cards into columns.
  const columnSize = Math.ceil(cards.length / columnCount);
  for (let i = 0; i < cards.length; i += columnSize) {
    columns.push(<CardsColumn key={i}>{cards.slice(i, i + columnSize)}</CardsColumn>);
  }

  return (
    <CardsWrapper columnCount={columnCount} ref={containerRef}>
      {columns}
    </CardsWrapper>
  );
}

const CardsWrapper = styled('div')<{columnCount: number}>`
  display: grid;
  align-items: start;
  grid-template-columns: repeat(${p => p.columnCount}, 1fr);
  gap: 10px;
`;

const CardsColumn = styled('div')`
  grid-column: span 1;
`;

function Description({
  value,
  linkTarget,
  linkText,
}: {
  value: string;
  linkTarget?: LocationDescriptor;
  linkText?: string;
}) {
  return (
    <DescriptionContainer>
      <DescriptionText>
        {value}
        <StyledCopuToClipboardButton borderless size="zero" iconSize="xs" text={value} />
      </DescriptionText>
      {linkTarget && linkTarget ? <Link to={linkTarget}>{linkText}</Link> : null}
    </DescriptionContainer>
  );
}

const StyledCopuToClipboardButton = styled(CopyToClipboardButton)`
  transform: translateY(2px);
`;

const DescriptionContainer = styled(FlexBox)`
  justify-content: space-between;
  gap: ${space(1)};
  flex-wrap: wrap;
`;

const DescriptionText = styled('span')`
  overflow-wrap: anywhere;
`;

const Card = styled(Panel)`
  margin-bottom: 10px;
  padding: ${space(0.75)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const CardContentTitle = styled('p')`
  grid-column: 1 / -1;
  padding: ${space(0.25)} ${space(0.75)};
  margin: 0;
  color: ${p => p.theme.headingColor};
  font-weight: bold;
`;

const ContentContainer = styled('div')`
  display: grid;
  column-gap: ${space(1.5)};
  grid-template-columns: minmax(100px, 150px) 1fr 30px;
  padding: ${space(0.25)} ${space(0.75)};
  border-radius: 4px;
  color: ${p => p.theme.subText};
  border: 1px solid 'transparent';
  background-color: ${p => p.theme.background};
  &:nth-child(odd) {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

export const CardContentSubject = styled('div')`
  grid-column: span 1;
  font-family: ${p => p.theme.text.familyMono};
  word-wrap: break-word;
`;

const CardContentValueWrapper = styled(CardContentSubject)<{hasSubject: boolean}>`
  color: ${p => p.theme.textColor};
  grid-column: ${p => (p.hasSubject ? 'span 2' : '1 / -1')};
`;

const TruncateActionWrapper = styled('div')`
  grid-column: 1 / -1;
  margin: ${space(0.5)} 0;
  display: flex;
  justify-content: center;
`;

const TraceDrawerComponents = {
  DetailContainer,
  FlexBox,
  Title: TitleWithTestId,
  Type,
  TitleOp,
  HeaderContainer,
  Actions,
  NodeActions,
  Table,
  IconTitleWrapper,
  IconBorder,
  TitleText,
  Duration,
  TableRow,
  LAZY_RENDER_PROPS,
  TableRowButtonContainer,
  TableValueRow,
  IssuesLink,
  SectionCard,
  Description,
  SectionCardGroup,
};

export {TraceDrawerComponents};
