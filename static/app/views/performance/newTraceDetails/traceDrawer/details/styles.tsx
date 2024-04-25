import {Fragment, type PropsWithChildren, useMemo} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {Button, LinkButton} from 'sentry/components/button';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {DataSection} from 'sentry/components/events/styles';
import FileSize from 'sentry/components/fileSize';
import type {LazyRenderProps} from 'sentry/components/lazyRender';
import Link from 'sentry/components/links/link';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron, IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {formatBytesBase10} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getDuration} from 'sentry/utils/formatters';
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

interface EventDetailsLinkProps {
  node: TraceTreeNode<TraceTree.NodeValue>;
  organization: Organization;
}

function EventDetailsLink(props: EventDetailsLinkProps) {
  const params = useMemo((): {
    eventId: string | undefined;
    projectSlug: string | undefined;
  } => {
    const eventId = props.node.metadata.event_id;
    const projectSlug = props.node.metadata.project_slug;

    if (eventId && projectSlug) {
      return {eventId, projectSlug};
    }

    if (isSpanNode(props.node) || isAutogroupedNode(props.node)) {
      const parent = props.node.parent_transaction;
      if (parent?.metadata.event_id && parent?.metadata.project_slug) {
        return {
          eventId: parent.metadata.event_id,
          projectSlug: parent.metadata.project_slug,
        };
      }
    }

    return {eventId: undefined, projectSlug: undefined};
  }, [props.node]);

  const locationDescriptor = useMemo(() => {
    const query = {...qs.parse(location.search), legacy: 1};

    return {
      query: query,
      pathname: `/performance/${params.projectSlug}:${params.eventId}/`,
      hash: isSpanNode(props.node) ? `#span-${props.node.value.span_id}` : undefined,
    };
  }, [params.eventId, params.projectSlug, props.node]);

  return (
    <LinkButton
      disabled={!params.eventId || !params.projectSlug}
      title={
        !params.eventId || !params.projectSlug
          ? t('Event ID or Project Slug missing')
          : undefined
      }
      size="xs"
      to={locationDescriptor}
      onClick={() => {
        trackAnalytics('performance_views.trace_details.view_event_details', {
          organization: props.organization,
        });
      }}
    >
      {t('View Event Details')}
    </LinkButton>
  );
}

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
}: {
  children: React.ReactNode;
  title: JSX.Element | string | null;
  extra?: React.ReactNode;
  keep?: boolean;
  prefix?: JSX.Element;
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
        </Flex>
      </td>
      <ValueTd className="value">
        <ValueRow>
          <StyledPre>
            <span className="val-string">{children}</span>
          </StyledPre>
          <ButtonContainer>{extra}</ButtonContainer>
        </ValueRow>
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

const ValueRow = styled('div')`
  display: grid;
  grid-template-columns: auto min-content;
  gap: ${space(1)};

  border-radius: 4px;
  background-color: ${p => p.theme.surface200};
  margin: 2px;
`;

const StyledPre = styled('pre')`
  margin: 0 !important;
  background-color: transparent !important;
`;

const ButtonContainer = styled('div')`
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
        props.onTabScrollToNode(props.node);
      },
    };

    const eventId = props.node.metadata.event_id;
    const projectSlug = props.node.metadata.project_slug;
    const query = {...qs.parse(location.search), legacy: 1};

    const eventDetailsLink = {
      query: query,
      pathname: `/performance/${projectSlug}:${eventId}/`,
      hash: isSpanNode(props.node) ? `#span-${props.node.value.span_id}` : undefined,
    };

    const viewEventDetails: MenuItemProps = {
      key: 'view-event-details',
      label: t('View Event Details'),
      to: eventDetailsLink,
    };

    const eventSize = props.eventSize;
    const jsonDetails: MenuItemProps = {
      key: 'json-details',
      onAction: () => {
        trackAnalytics('performance_views.trace_details.view_event_json', {
          organization: props.organization,
        });
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
      return [showInView, viewEventDetails, jsonDetails];
    }
    if (isSpanNode(props.node)) {
      return [showInView, viewEventDetails];
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
        <Button size="xs" onClick={_e => props.onTabScrollToNode(props.node)}>
          {t('Show in view')}
        </Button>

        {isTransactionNode(props.node) ||
        isSpanNode(props.node) ||
        isTraceErrorNode(props.node) ? (
          <EventDetailsLink node={props.node} organization={props.organization} />
        ) : null}

        {isTransactionNode(props.node) ? (
          <Button
            size="xs"
            icon={<IconOpen />}
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
  EventDetailsLink,
  TitleText,
  Duration,
  TableRow,
  LAZY_RENDER_PROPS,
  IssuesLink,
};

export {TraceDrawerComponents};
