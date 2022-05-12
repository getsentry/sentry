import React from 'react';
import styled from '@emotion/styled';
import first from 'lodash/first';

import Icon from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon';
import * as Timeline from 'sentry/components/replays/breadcrumbs/timeline';
import Tooltip from 'sentry/components/tooltip';
import space from 'sentry/styles/space';
import {Crumb} from 'sentry/types/breadcrumbs';
import type {Color} from 'sentry/utils/theme';

import {getCrumbsByColumn} from '../utils';

const EVENT_STICK_MARKER_WIDTH = 2;

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

function Event({crumbs}: {crumbs: Crumb[]; className?: string}) {
  const breadcrumb = first(crumbs);
  if (!breadcrumb) {
    return null;
  }

  const icon = crumbs.length === 1 ? <Icon type={breadcrumb.type} /> : crumbs.length;

  return (
    <IconPosition>
      <Tooltip
        key={breadcrumb.id}
        title={`${breadcrumb.category}: ${breadcrumb.message}`}
        skipWrapper
        disableForVisualTest
      >
        <IconNode color={breadcrumb.color}>{icon}</IconNode>
      </Tooltip>
    </IconPosition>
  );
}

const IconPosition = styled('div')`
  position: absolute;
  transform: translate(-50%);
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
