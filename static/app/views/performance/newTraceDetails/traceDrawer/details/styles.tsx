import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {Button as CommonButton, LinkButton} from 'sentry/components/button';
import {DataSection} from 'sentry/components/events/styles';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getDuration} from 'sentry/utils/formatters';

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
`;

const Title = styled(FlexBox)`
  gap: ${space(1)};
  flex: none;
`;

const Type = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
`;

const TitleOp = styled('div')`
  font-size: 15px;
  font-weight: bold;
  max-width: 600px;
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
`;

function EventDetailsLink(props: {eventId: string; projectSlug?: string}) {
  const query = useMemo(() => {
    return {...qs.parse(location.search), legacy: 1};
  }, []);

  return (
    <LinkButton
      disabled={!props.eventId || !props.projectSlug}
      title={
        !props.eventId || !props.projectSlug
          ? t('Event ID or Project Slug missing')
          : undefined
      }
      size="xs"
      to={{
        pathname: `/performance/${props.projectSlug}:${props.eventId}/`,
        query: query,
      }}
    >
      {t('View Event Details')}
    </LinkButton>
  );
}

type DurationComparisonProps = {
  baseline: number | undefined;
  totalDuration: number;
  isComparingSelfDuration?: boolean;
  selfDuration?: number;
};

const DURATION_COMPARISON_STATUS_COLORS = {
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

function DurationComparison(props: DurationComparisonProps) {
  const duration =
    props.isComparingSelfDuration && typeof props.selfDuration === 'number'
      ? props.selfDuration
      : props.totalDuration;
  if (typeof props.baseline !== 'number' || isNaN(props.baseline)) {
    return <Duration>{getDuration(duration, 2, true)}</Duration>;
  }

  const delta = duration - props.baseline;
  const deltaPct = Number(Math.abs((delta / props.baseline) * 100).toFixed(2));
  const formattedAvgDuration = getDuration(props.baseline, 2, true);
  const status = delta > 0 ? 'slower' : delta < 0 ? 'faster' : 'equal';

  const deltaText =
    status === 'equal'
      ? t(`Equal to avg %s`, `${deltaPct}%`, formattedAvgDuration)
      : status === 'faster'
        ? t(`-%s faster than avg %s`, `${deltaPct}%`, formattedAvgDuration)
        : t(`+%s slower than avg %s`, `${deltaPct}%`, formattedAvgDuration);

  return (
    <Fragment>
      <Duration>
        {getDuration(duration, 2, true)}{' '}
        {props.isComparingSelfDuration && typeof props.selfDuration === 'number'
          ? `(${Number(Math.abs((props.selfDuration - props.totalDuration / props.totalDuration) * 100).toFixed())}%)`
          : null}
      </Duration>
      {deltaPct >= MIN_PCT_DURATION_DIFFERENCE ? (
        <Comparison status={status}>{deltaText}</Comparison>
      ) : null}
    </Fragment>
  );
}

const Duration = styled('span')`
  font-weight: bold;
  margin-right: ${space(1)};
`;

const Comparison = styled('span')<{status: 'faster' | 'slower' | 'equal'}>`
  color: ${p => p.theme[DURATION_COMPARISON_STATUS_COLORS[p.status].normal]};
`;

const TraceDrawerComponents = {
  DetailContainer,
  FlexBox,
  Title,
  Type,
  TitleOp,
  HeaderContainer,
  Actions,
  Table,
  IconTitleWrapper,
  IconBorder,
  EventDetailsLink,
  Button,
  DurationComparison,
};

export {TraceDrawerComponents};
