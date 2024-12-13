import {Fragment} from 'react';
import styled from '@emotion/styled';
import color from 'color';
import sortBy from 'lodash/sortBy';
import startCase from 'lodash/startCase';

import {LinkButton} from 'sentry/components/button';
import {DateTime} from 'sentry/components/dateTime';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Text from 'sentry/components/text';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {
  IconCheckmark,
  IconFatal,
  IconFire,
  IconInfo,
  IconOpen,
  IconWarning,
} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  StatuspageIncident,
  StatusPageIncidentUpdate,
  StatusPageServiceStatus,
} from 'sentry/types/system';
import marked from 'sentry/utils/marked';
import type {ColorOrAlias} from 'sentry/utils/theme';

interface Props {
  incident: StatuspageIncident;
}

const COMPONENT_STATUS_SORT: StatusPageServiceStatus[] = [
  'operational',
  'degraded_performance',
  'partial_outage',
  'major_outage',
];

export function ServiceIncidentDetails({incident}: Props) {
  const isResolved = incident.status === 'resolved';
  const start = incident.started_at ?? incident.created_at;

  const affectedText = isResolved
    ? tct(
        'From [start] until [end] we experienced problems with the following services',
        {
          start: (
            <strong>
              <DateTime date={start} />
            </strong>
          ),
          end: (
            <strong>
              <DateTime date={incident.resolved_at} />
            </strong>
          ),
        }
      )
    : tct(
        "This incident started [timeAgo]. We're experiencing problems with the following services",
        {
          timeAgo: (
            <strong>
              <TimeSince date={start} />
            </strong>
          ),
        }
      );

  return (
    <Fragment>
      <Title>{incident.name}</Title>
      <LinkButton
        size="xs"
        icon={<IconOpen />}
        priority="link"
        href={incident.shortlink}
        external
      >
        {t('Full Incident Details')}
      </LinkButton>
      <AffectedServices>
        {affectedText}
        <ComponentList>
          {sortBy(incident.components, i => COMPONENT_STATUS_SORT.indexOf(i.status)).map(
            ({name, status}, key) => (
              <ComponentStatus key={key} padding="20px" symbol={getStatusSymbol(status)}>
                {name}
              </ComponentStatus>
            )
          )}
        </ComponentList>
      </AffectedServices>

      <UpdatesList>
        {incident.incident_updates.map(({status, body, display_at, created_at}, key) => (
          <ListItem key={key}>
            <UpdateHeading status={status}>
              <StatusTitle>{startCase(status)}</StatusTitle>
              <StatusDate>
                {tct('([time])', {
                  time: isResolved ? (
                    <DateTime date={display_at ?? created_at} />
                  ) : (
                    <TimeSince date={display_at ?? created_at} />
                  ),
                })}
              </StatusDate>
            </UpdateHeading>
            <Text dangerouslySetInnerHTML={{__html: marked(body)}} />
          </ListItem>
        ))}
      </UpdatesList>
    </Fragment>
  );
}

function getStatusSymbol(status: StatusPageServiceStatus) {
  return (
    <Tooltip skipWrapper title={startCase(status)}>
      {status === 'operational' ? (
        <IconCheckmark size="sm" isCircled color="successText" />
      ) : status === 'major_outage' ? (
        <IconFatal size="sm" color="errorText" />
      ) : status === 'degraded_performance' ? (
        <IconWarning size="sm" color="warningText" />
      ) : status === 'partial_outage' ? (
        <IconFire size="sm" color="warningText" />
      ) : (
        <IconInfo size="sm" color="subText" />
      )}
    </Tooltip>
  );
}

const Title = styled('h2')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: ${space(1)};
`;

const AffectedServices = styled('div')`
  margin: ${space(2)} 0;
`;

const UpdatesList = styled(List)`
  gap: ${space(3)};
  margin-left: ${space(1.5)};
  position: relative;

  &::before {
    content: '';
    display: block;
    position: absolute;
    height: 100%;
    width: 2px;
    margin: ${space(1)} 0 ${space(1)} -${space(1.5)};
    background: ${p => p.theme.gray100};
  }

  &::after {
    content: '';
    display: block;
    position: absolute;
    bottom: -${space(1)};
    margin-left: -${space(1.5)};
    height: 30px;
    width: 2px;
    background: linear-gradient(
      0deg,
      ${p => p.theme.background},
      ${p => color(p.theme.background).alpha(0).string()}
    );
  }
`;

type UpdateStatus = StatusPageIncidentUpdate['status'];

const indicatorColor: Record<UpdateStatus, ColorOrAlias> = {
  investigating: 'red200',
  identified: 'blue200',
  monitoring: 'yellow200',
  resolved: 'green200',
};

const UpdateHeading = styled('div')<{status: UpdateStatus}>`
  margin-bottom: ${space(0.5)};
  display: flex;
  align-items: center;
  gap: ${space(1)};
  position: relative;

  &::before {
    content: '';
    display: block;
    position: absolute;
    height: 8px;
    width: 8px;
    margin-left: -15px;
    border-radius: 50%;
    background: ${p => p.theme[indicatorColor[p.status]]};
  }
`;

const StatusTitle = styled('div')`
  color: ${p => p.theme.headingColor};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const StatusDate = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeRelativeSmall};
`;

const ComponentList = styled(List)`
  margin-top: ${space(1)};
  display: block;
  column-count: 2;
`;

const ComponentStatus = styled(ListItem)`
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 2;
`;
