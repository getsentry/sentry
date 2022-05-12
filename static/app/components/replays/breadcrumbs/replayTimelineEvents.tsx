import React from 'react';
import styled from '@emotion/styled';

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
          <Icons crumbs={breadcrumbs} />
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
`;

function ColumnIcons({crumbs, className}: {crumbs: Crumb[]; className?: string}) {
  return (
    <div className={className}>
      {crumbs.map(breadcrumb => (
        <Tooltip
          key={breadcrumb.id}
          title={`${breadcrumb.category}: ${breadcrumb.message}`}
          skipWrapper
          disableForVisualTest
        >
          <IconWrapper color={breadcrumb.color}>
            <Icon type={breadcrumb.type} />
          </IconWrapper>
        </Tooltip>
      ))}
    </div>
  );
}

const Icons = styled(ColumnIcons)`
  position: absolute;
  transform: translate(-50%);
`;
const IconWrapper = styled('div')<{color: Color}>`
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
  position: relative;
`;

export default ReplayTimelineEvents;
