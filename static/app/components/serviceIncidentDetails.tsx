import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';
import startCase from 'lodash/startCase';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Prose, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DateTime} from 'sentry/components/dateTime';
import {TimeSince} from 'sentry/components/timeSince';
import {
  IconCheckmark,
  IconFatal,
  IconFire,
  IconInfo,
  IconOpen,
  IconWarning,
} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {
  StatuspageIncident,
  StatusPageIncidentUpdate,
  StatusPageServiceStatus,
} from 'sentry/types/system';
import {sanitizedMarked} from 'sentry/utils/marked/marked';

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
  const hasComponents = incident.components.length > 0;

  const affectedText = isResolved
    ? hasComponents
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
      : tct('From [start] until [end] we experienced problems.', {
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
        })
    : hasComponents
      ? tct(
          "This incident started [timeAgo]. We're experiencing problems with the following services",
          {
            timeAgo: (
              <strong>
                <TimeSince date={start} />
              </strong>
            ),
          }
        )
      : tct('This incident started [timeAgo].', {
          timeAgo: (
            <strong>
              <TimeSince date={start} />
            </strong>
          ),
        });

  return (
    <Stack gap="md">
      <Stack gap="xs">
        <Text size="lg" bold>
          {incident.name}{' '}
        </Text>
        <Flex align="center" gap="sm">
          {p => (
            <ExternalLink {...p} href={incident.shortlink}>
              <IconOpen size="sm" /> {t('view incident details')}
            </ExternalLink>
          )}
        </Flex>
      </Stack>
      <Container padding="md 0">
        <Stack gap="md">
          <Text size="md">{affectedText}</Text>
          {incident.components.length > 0 && (
            <Grid columns="1fr 1fr" gap="xs md">
              {sortBy(incident.components, i =>
                COMPONENT_STATUS_SORT.indexOf(i.status)
              ).map(({name, status}, key) => (
                <Flex key={key} align="center" gap="sm">
                  {getStatusSymbol(status)}
                  <Text size="sm">{name}</Text>
                </Flex>
              ))}
            </Grid>
          )}
        </Stack>
      </Container>

      <UpdatesList
        as="ul"
        columns="auto 1fr"
        rows={`repeat(${incident.incident_updates.length}, auto)`}
        gap="lg md"
      >
        {incident.incident_updates.map(({status, body, display_at, created_at}, key) => (
          <Grid
            as="li"
            key={key}
            column="1 / -1"
            row={`${key + 1}`}
            columns="subgrid"
            rows="auto auto"
            align="center"
            gap="xs md"
          >
            <StatusIndicator variant={STATUS_VARIANT[status]} />
            <Flex column="2" row="1" align="center" gap="md">
              <Text bold>{startCase(status)}</Text>
              <Text variant="muted">
                {tct('([time])', {
                  time: isResolved ? (
                    <DateTime date={display_at ?? created_at} />
                  ) : (
                    <TimeSince date={display_at ?? created_at} />
                  ),
                })}
              </Text>
            </Flex>
            <Container column="2" row="2">
              <Prose dangerouslySetInnerHTML={{__html: sanitizedMarked(body)}} />
            </Container>
          </Grid>
        ))}
      </UpdatesList>
    </Stack>
  );
}

function getStatusSymbol(status: StatusPageServiceStatus) {
  return (
    <Tooltip skipWrapper title={startCase(status)}>
      {status === 'operational' ? (
        <IconCheckmark size="sm" variant="success" />
      ) : status === 'major_outage' ? (
        <IconFatal size="sm" variant="danger" />
      ) : status === 'degraded_performance' ? (
        <IconWarning size="sm" variant="warning" />
      ) : status === 'partial_outage' ? (
        <IconFire size="sm" variant="warning" />
      ) : (
        <IconInfo size="sm" variant="muted" />
      )}
    </Tooltip>
  );
}

const STATUS_VARIANT: Record<
  StatusPageIncidentUpdate['status'],
  React.ComponentProps<typeof StatusIndicator>['variant']
> = {
  investigating: 'danger',
  identified: 'accent',
  monitoring: 'warning',
  resolved: 'success',
};

const UpdatesList = styled(Grid)`
  list-style: none;
  padding: 0;
  margin: 0;

  &::after {
    content: '';
    grid-column: 1;
    grid-row: 1 / -1;
    justify-self: center;
    width: 2px;
    margin-top: 0.5lh;
    background: linear-gradient(
      to bottom,
      ${p => p.theme.tokens.background.tertiary} 0,
      ${p => p.theme.tokens.background.tertiary} calc(100% - 30px),
      transparent 100%
    );
  }
`;
