import {Fragment, type PropsWithChildren, useMemo} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {Button as CommonButton, LinkButton} from 'sentry/components/button';
import {DataSection} from 'sentry/components/events/styles';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getDuration} from 'sentry/utils/formatters';
import type {ColorOrAlias} from 'sentry/utils/theme';
import {
  isAutogroupedNode,
  isSpanNode,
} from 'sentry/views/performance/newTraceDetails/guards';
import type {
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
`;

const Title = styled(FlexBox)`
  gap: ${space(1)};
  flex: none;
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

const Button = styled(CommonButton)`
  position: absolute;
  top: ${space(0.75)};
  right: ${space(0.5)};
`;

const HeaderContainer = styled(Title)`
  justify-content: space-between;
  overflow: hidden;
  width: 100%;
`;

interface EventDetailsLinkProps {
  node: TraceTreeNode<TraceTree.NodeValue>;
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

const DurationContainer = styled('span')`
  font-weight: bold;
  margin-right: ${space(1)};
`;

const Comparison = styled('span')<{status: 'faster' | 'slower' | 'equal'}>`
  color: ${p => p.theme[DURATION_COMPARISON_STATUS_COLORS[p.status].normal]};
`;

const TraceDrawerComponents = {
  DetailContainer,
  FlexBox,
  Title: TitleWithTestId,
  Type,
  TitleOp,
  HeaderContainer,
  Actions,
  Table,
  IconTitleWrapper,
  IconBorder,
  EventDetailsLink,
  Button,
  TitleText,
  Duration,
};

export {TraceDrawerComponents};
