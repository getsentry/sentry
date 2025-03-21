import {Fragment, useCallback} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import Color from 'color';
import moment, {type Moment} from 'moment-timezone';

import type {TimeWindowConfig} from 'sentry/components/checkInTimeline/types';
import {Alert} from 'sentry/components/core/alert';
import {Hovercard} from 'sentry/components/hovercard';
import {ServiceIncidentDetails} from 'sentry/components/serviceIncidentDetails';
import {IconExclamation} from 'sentry/icons';
import {t} from 'sentry/locale';
import {StatusPageComponent, type StatuspageIncident} from 'sentry/types/system';
import {useServiceIncidents} from 'sentry/utils/useServiceIncidents';

interface CronServiceIncidentsProps {
  timeWindowConfig: TimeWindowConfig;
}

interface GetTimeWindowConfigOptions {
  inc: StatuspageIncident;
  /**
   * Clamp the incident start and end times to be the timeWindowConfig start
   * and end
   */
  clamp?: boolean;
}

function CronServiceIncidents({timeWindowConfig}: CronServiceIncidentsProps) {
  const {data: incidents} = useServiceIncidents({
    // TODO(epurkhiser): There is also the EU region. We should make sure we
    // filter down to that region as well
    componentFilter: [StatusPageComponent.US_CRON_MONITORING],
    includeResolved: true,
  });

  const getIncidentTimes = useCallback(
    ({inc, clamp}: GetTimeWindowConfigOptions) => {
      const start = inc.started_at ? moment(inc.started_at) : moment(inc.created_at);
      const end = inc.resolved_at
        ? moment(inc.resolved_at)
        : moment(timeWindowConfig.end);

      if (!clamp) {
        return {start, end};
      }

      return {
        start: moment.max(start, moment(timeWindowConfig.start)),
        end: moment.min(end, moment(timeWindowConfig.end)),
      };
    },
    [timeWindowConfig]
  );

  const getPositionFromTime = useCallback(
    (time: Moment) => {
      const {start, elapsedMinutes, timelineWidth} = timeWindowConfig;
      const msPerPixel = (elapsedMinutes * 60 * 1000) / timelineWidth;

      return (time.valueOf() - start.getTime()) / msPerPixel;
    },
    [timeWindowConfig]
  );

  const incidentsInWindow = incidents?.filter(inc => {
    const {start: windowStart, end: windowEnd} = timeWindowConfig;
    const {start, end} = getIncidentTimes({inc});

    const startInWindow = start.isBetween(windowStart, windowEnd, undefined, '[]');
    const endInWindow = end.isBetween(windowStart, windowEnd, undefined, '[]');
    const overlapsWindow = start.isBefore(windowStart) && end.isAfter(windowEnd);

    return startInWindow || endInWindow || overlapsWindow;
  });

  if (!incidentsInWindow) {
    return null;
  }

  return incidentsInWindow.map(inc => {
    const {start, end} = getIncidentTimes({inc, clamp: true});

    const position = css`
      --incidentOverlayStart: ${getPositionFromTime(start)}px;
      --incidentOverlayEnd: ${getPositionFromTime(end)}px;
    `;

    const alertMessage =
      inc.status === 'unresolved'
        ? t(
            'Sentry is currently experiencing an outage which may affect Check-In reliability.'
          )
        : t(
            "Sentry experienced an outage which may have affected check-in's during this time."
          );

    return (
      <Fragment key={inc.id}>
        <IncidentHovercard
          skipWrapper
          body={
            <Fragment>
              <Alert.Container>
                <Alert type="warning">{alertMessage}</Alert>
              </Alert.Container>
              <ServiceIncidentDetails incident={inc} />
            </Fragment>
          }
        >
          <IncidentIndicator css={position}>
            <IconExclamation color="white" />
          </IncidentIndicator>
        </IncidentHovercard>
        <IncidentOverlay css={position} />
      </Fragment>
    );
  });
}

const IncidentHovercard = styled(Hovercard)`
  width: 400px;
  max-height: 500px;
  overflow-y: scroll;
`;

const IncidentOverlay = styled('div')`
  position: absolute;
  top: 50px;
  height: 100%;
  height: calc(100% - 50px);
  left: var(--incidentOverlayStart);
  width: calc(var(--incidentOverlayEnd) - var(--incidentOverlayStart));
  pointer-events: none;
  background: ${p => Color(p.theme.yellow100).alpha(0.05).toString()};
  border-left: 1px solid ${p => p.theme.yellow200};
  border-right: 1px solid ${p => p.theme.yellow200};
  z-index: 2;
`;

const IncidentIndicator = styled('div')`
  position: absolute;
  top: 50px;
  left: var(--incidentOverlayStart);
  width: calc(var(--incidentOverlayEnd) - var(--incidentOverlayStart));
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  z-index: 2;
  height: 20px;

  > svg,
  &:before {
    background: ${p => p.theme.yellow300};
  }

  > svg {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 50%;
    height: 16px;
    width: 16px;
    padding: 3px;
  }

  &:before {
    content: '';
    display: block;
    height: 3px;
    width: inherit;
  }
`;

export {CronServiceIncidents};
