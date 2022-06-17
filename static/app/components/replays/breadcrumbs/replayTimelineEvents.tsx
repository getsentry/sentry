import styled from '@emotion/styled';

import Type from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type';
import Icon from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon';
import * as Timeline from 'sentry/components/replays/breadcrumbs/timeline';
import Tooltip from 'sentry/components/tooltip';
import space from 'sentry/styles/space';
import {BreadcrumbType, Crumb} from 'sentry/types/breadcrumbs';
import type {Color} from 'sentry/utils/theme';

import {getCrumbsByColumn} from '../utils';

import {getDescription, getTitle} from './utils';

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
    case BreadcrumbType.ERROR:
      return `${crumb.data?.label}: ${crumb.message}`;
    default:
      return getDescription(crumb);
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
          <small>{getCrumbDetail(crumb) || getTitle(crumb)}</small>
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
      <Tooltip key={mostInteresting.id} title={title}>
        <IconNode color={mostInteresting.color}>{icon}</IconNode>
      </Tooltip>
    </IconPosition>
  );
}

const HoverList = styled('ul')`
  margin: 0;
  padding: 0;
`;

const HoverListItem = styled('li')`
  display: grid;
  grid-template-columns: max-content 150px;
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
