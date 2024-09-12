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
import {DataSection} from 'sentry/components/events/styles';
import FileSize from 'sentry/components/fileSize';
import KeyValueData, {
  CardPanel,
  type KeyValueDataContentProps,
  Subject,
} from 'sentry/components/keyValueData';
import {LazyRender, type LazyRenderProps} from 'sentry/components/lazyRender';
import Link from 'sentry/components/links/link';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron, IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, EventTransaction} from 'sentry/types/event';
import type {KeyValueListData} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import getDuration from 'sentry/utils/duration/getDuration';
import type {ColorOrAlias} from 'sentry/utils/theme';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  isAutogroupedNode,
  isMissingInstrumentationNode,
  isRootNode,
  isSpanNode,
  isTraceErrorNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/guards';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import {useTransaction} from 'sentry/views/performance/newTraceDetails/traceApi/useTransaction';
import {useDrawerContainerRef} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/drawerContainerRefContext';
import {makeTraceContinuousProfilingLink} from 'sentry/views/performance/newTraceDetails/traceDrawer/traceProfilingLink';
import type {
  MissingInstrumentationNode,
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

const TitleText = styled('div')`
  ${p => p.theme.overflowEllipsis}
`;

function TitleWithTestId(props: PropsWithChildren<{}>) {
  return <Title data-test-id="trace-drawer-title">{props.children}</Title>;
}

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

const HeaderContainer = styled(FlexBox)`
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

  return (
    <Link
      to={{
        pathname: `/organizations/${organization.slug}/issues/`,
        query: {
          query: `trace:${traceSlug}`,
          start: new Date(node.space[0]).toISOString(),
          end: new Date(node.space[0] + node.space[1]).toISOString(),
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
  const navigate = useNavigate();
  const organization = useOrganization();
  const params = useParams<{traceSlug?: string}>();

  const {data: transaction} = useTransaction({
    node: isTransactionNode(props.node) ? props.node : null,
    organization,
  });

  const profilerId = useMemo(() => {
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

  const items = useMemo((): MenuItemProps[] => {
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

    const continuousProfileLink: MenuItemProps | null =
      organization.features.includes('continuous-profiling-ui') && !!profileLink
        ? {
            key: 'continuous-profile',
            onAction: () => {
              traceAnalytics.trackViewContinuousProfile(props.organization);
              navigate(profileLink!);
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
  }, [props, profileLink, navigate, organization.features]);

  return (
    <ActionsContainer>
      <Actions className="Actions">
        {organization.features.includes('continuous-profiling-ui') && !!profileLink ? (
          <LinkButton size="xs" to={profileLink}>
            {t('Continuous Profile')}
          </LinkButton>
        ) : null}
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
          <LinkButton
            size="xs"
            icon={<IconOpen />}
            onClick={() => traceAnalytics.trackViewEventJSON(props.organization)}
            href={`/api/0/projects/${props.organization.slug}/${props.node.value.project_slug}/events/${props.node.value.event_id}/json/`}
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
  CopyableCardValueWithLink,
  EventTags,
  TraceDataSection,
  SectionCardGroup,
  DropdownMenuWithPortal,
};

export {TraceDrawerComponents};
