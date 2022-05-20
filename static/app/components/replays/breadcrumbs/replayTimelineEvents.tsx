import styled from '@emotion/styled';

import Type from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type';
import Icon from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon';
import {Hovercard} from 'sentry/components/hovercard';
import * as Timeline from 'sentry/components/replays/breadcrumbs/timeline';
import space from 'sentry/styles/space';
import {BreadcrumbType, Crumb} from 'sentry/types/breadcrumbs';
import type {Color} from 'sentry/utils/theme';

import {getCrumbsByColumn} from '../utils';

const EVENT_STICK_MARKER_WIDTH = 4;

type Props = {
  crumbs: Crumb[];
  duration: number;
  startTimestamp: number;
  width: number;
  className?: string;
};

function ReplayTimelineEvents({
  className,
  crumbs,
  duration,
  startTimestamp,
  width,
}: Props) {
  const totalColumns = Math.floor(width / EVENT_STICK_MARKER_WIDTH);
  const eventsByCol = getCrumbsByColumn(startTimestamp, duration, crumbs, totalColumns);

  return (
    <EventColumns className={className} totalColumns={totalColumns} remainder={0}>
      {Array.from(eventsByCol.entries()).map(([column, breadcrumbs]) => (
        <EventColumn key={column} column={column}>
          <Event crumbs={breadcrumbs} />
        </EventColumn>
      ))}
    </EventColumns>
  );
}

const EventColumns = styled(Timeline.Columns)`
  height: ${space(4)};
  margin-top: ${space(1)};
`;

const EventColumn = styled(Timeline.Col)<{column: number}>`
  grid-column: ${p => Math.floor(p.column)};
  place-items: stretch;
  display: grid;

  &:hover {
    z-index: ${p => p.theme.zIndex.initial};
  }
`;

function getCrumbDetail(crumb: Crumb) {
  switch (crumb.type) {
    case BreadcrumbType.USER:
    case BreadcrumbType.UI:
      return crumb.message ?? crumb.description;
    case BreadcrumbType.NAVIGATION:
      return crumb.data?.to ?? crumb.description;
    case BreadcrumbType.ERROR:
      return `${crumb.data?.type}: ${crumb.data?.value}`;
    default:
      return crumb.message;
  }
}

function sortByMostInterestingType(a: Crumb, b: Crumb) {
  const rank = {
    [BreadcrumbType.USER]: 0,
    [BreadcrumbType.UI]: 0,
    [BreadcrumbType.NAVIGATION]: 1,
    [BreadcrumbType.ERROR]: 2,
  };

  return rank[a.type] - rank[b.type];
}

function Event({crumbs}: {crumbs: Crumb[]; className?: string}) {
  const title = (
    <HoverList>
      {crumbs.map(crumb => (
        <HoverListItem key={crumb.id}>
          <Type type={crumb.type} color={crumb.color} description={crumb.description} />
          <small>{getCrumbDetail(crumb)}</small>
        </HoverListItem>
      ))}
    </HoverList>
  );

  const mostInteresting = crumbs.reduce((best, crumb) =>
    sortByMostInterestingType(best, crumb) >= 1 ? best : crumb
  );

  const icon = crumbs.length === 1 ? <Icon type={mostInteresting.type} /> : crumbs.length;

  return (
    <IconPosition>
      <Hovercard key={mostInteresting.id} body={title}>
        <IconNode color={mostInteresting.color}>{icon}</IconNode>
      </Hovercard>
    </IconPosition>
  );
}

const HoverList = styled('ul')`
  margin: 0;
  padding: 0;
`;
const HoverListItem = styled('li')`
  display: flex;
  gap: ${space(1)};
  padding: ${space(0.5)};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  &:last-child {
    border-bottom: none;
  }
`;

const IconPosition = styled('div')`
  position: absolute;
  transform: translate(-50%);
  margin-left: ${EVENT_STICK_MARKER_WIDTH / 2}px;
`;

const IconNode = styled('div')<{color: Color}>`
  font-size: ${p => p.theme.fontSizeSmall};
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: ${p => p.theme.white};
  background: ${p => p.theme[p.color] ?? p.color};
  border: 1px solid ${p => p.theme.white};
  box-shadow: ${p => p.theme.dropShadowLightest};
`;

export default ReplayTimelineEvents;
