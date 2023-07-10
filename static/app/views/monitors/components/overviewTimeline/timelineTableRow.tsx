import {Fragment, useState} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Placeholder from 'sentry/components/placeholder';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {Monitor} from 'sentry/views/monitors/types';
import {scheduleAsText} from 'sentry/views/monitors/utils';

import {CheckInTimeline, CheckInTimelineProps} from './checkInTimeline';
import {MonitorBucket} from './types';

interface Props extends Omit<CheckInTimelineProps, 'bucketedData' | 'environment'> {
  monitor: Monitor;
  bucketedData?: MonitorBucket[];
}

const MAX_SHOWN_ENVIRONMENTS = 4;

export function TimelineTableRow({monitor, bucketedData, ...timelineProps}: Props) {
  const [isExpanded, setExpanded] = useState(
    monitor.environments.length <= MAX_SHOWN_ENVIRONMENTS
  );

  const environments = isExpanded
    ? monitor.environments
    : monitor.environments.slice(0, MAX_SHOWN_ENVIRONMENTS);

  return (
    <Fragment key={monitor.id}>
      <MonitorDetails monitor={monitor} />
      <MonitorEnvContainer>
        {environments.map(({name}) => (
          <MonitorEnvLabel key={name}>{name}</MonitorEnvLabel>
        ))}
        {!isExpanded && (
          <Button size="xs" onClick={() => setExpanded(true)}>
            {tct('Show [num] More', {
              num: monitor.environments.length - MAX_SHOWN_ENVIRONMENTS,
            })}
          </Button>
        )}
      </MonitorEnvContainer>
      {!bucketedData ? (
        <TimelinePlaceholder />
      ) : (
        <TimelineContainer>
          {environments.map(({name}) => {
            return (
              <CheckInTimeline
                key={name}
                {...timelineProps}
                bucketedData={bucketedData}
                environment={name}
              />
            );
          })}
        </TimelineContainer>
      )}
    </Fragment>
  );
}

function MonitorDetails({monitor}: {monitor: Monitor}) {
  const organization = useOrganization();
  const schedule = scheduleAsText(monitor.config);

  const monitorDetailUrl = `/organizations/${organization.slug}/crons/${monitor.slug}/`;

  return (
    <DetailsContainer to={monitorDetailUrl}>
      <Name>{monitor.name}</Name>
      <Schedule>{schedule}</Schedule>
    </DetailsContainer>
  );
}

const DetailsContainer = styled(Link)`
  color: ${p => p.theme.textColor};
  padding: ${space(3)};
  border-right: 1px solid ${p => p.theme.border};
  border-radius: 0;
`;

const Name = styled('h3')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: ${space(0.25)};
`;

const Schedule = styled('small')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const MonitorEnvContainer = styled('div')`
  display: flex;
  padding: ${space(3)} ${space(2)};
  flex-direction: column;
  gap: ${space(4)};
  border-right: 1px solid ${p => p.theme.innerBorder};
  text-align: right;
`;

const MonitorEnvLabel = styled('div')`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;

const TimelineContainer = styled('div')`
  display: flex;
  padding: ${space(3)} 0;
  flex-direction: column;
  gap: ${space(4)};
`;

const TimelinePlaceholder = styled(Placeholder)`
  align-self: center;
`;
