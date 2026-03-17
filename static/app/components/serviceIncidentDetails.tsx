import styled from '@emotion/styled';
// eslint-disable-next-line no-restricted-imports
import color from 'color';
import sortBy from 'lodash/sortBy';
import startCase from 'lodash/startCase';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Prose, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DateTime} from 'sentry/components/dateTime';
import {List} from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import TimeSince from 'sentry/components/timeSince';
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
import type {Theme} from 'sentry/utils/theme';
import {unreachable} from 'sentry/utils/unreachable';

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
            <ComponentList>
              {sortBy(incident.components, i =>
                COMPONENT_STATUS_SORT.indexOf(i.status)
              ).map(({name, status}, key) => (
                <ComponentStatus key={key} symbol={getStatusSymbol(status)}>
                  {name}
                </ComponentStatus>
              ))}
            </ComponentList>
          )}
        </Stack>
      </Container>

      <UpdatesList>
        {incident.incident_updates.map(({status, body, display_at, created_at}, key) => (
          <ListItem key={key}>
            <UpdateHeading status={status}>
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
            </UpdateHeading>
            <Prose dangerouslySetInnerHTML={{__html: sanitizedMarked(body)}} />
          </ListItem>
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

const UpdatesList = styled(List)`
  gap: ${p => p.theme.space['2xl']};
  margin-left: ${p => p.theme.space.lg};
  position: relative;

  &::before {
    content: '';
    display: block;
    position: absolute;
    height: 100%;
    width: 2px;
    margin: ${p => p.theme.space.md} 0 ${p => p.theme.space.md} -${p => p.theme.space.lg};
    background: ${p => p.theme.colors.gray100};
  }

  &::after {
    content: '';
    display: block;
    position: absolute;
    bottom: -${p => p.theme.space.md};
    margin-left: -${p => p.theme.space.lg};
    height: 30px;
    width: 2px;
    background: linear-gradient(
      0deg,
      ${p => p.theme.tokens.background.primary},
      ${p => color(p.theme.tokens.background.primary).alpha(0).string()}
    );
  }
`;

function getIndicatorBackground({
  theme,
  status,
}: {
  status: StatusPageIncidentUpdate['status'];
  theme: Theme;
}): string {
  switch (status) {
    case 'investigating':
      return theme.tokens.graphics.danger.vibrant;
    case 'identified':
      return theme.tokens.graphics.accent.vibrant;
    case 'monitoring':
      return theme.tokens.graphics.warning.vibrant;
    case 'resolved':
      return theme.tokens.graphics.success.vibrant;
    default:
      unreachable(status);
      throw new TypeError(`Invalid status, got ${status}`);
  }
}

function getIndicatorBorder({
  theme,
  status,
}: {
  status: StatusPageIncidentUpdate['status'];
  theme: Theme;
}): string {
  switch (status) {
    case 'investigating':
      return theme.tokens.border.danger.muted;
    case 'identified':
      return theme.tokens.border.accent.muted;
    case 'monitoring':
      return theme.tokens.border.warning.muted;
    case 'resolved':
      return theme.tokens.border.success.muted;
    default:
      unreachable(status);
      throw new TypeError(`Invalid status, got ${status}`);
  }
}

const UpdateHeading = styled('div')<{status: StatusPageIncidentUpdate['status']}>`
  margin-bottom: ${p => p.theme.space.xs};
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  position: relative;

  &::before {
    content: '';
    display: block;
    position: absolute;
    height: 10px;
    width: 10px;
    margin-left: -16px;
    border-radius: 50%;
    background: ${getIndicatorBackground};
    border: 2px solid ${getIndicatorBorder};
  }
`;

const ComponentList = styled(List)`
  margin-top: ${p => p.theme.space.md};
  display: block;
  column-count: 2;
`;

const ComponentStatus = styled(ListItem)`
  font-size: ${p => p.theme.font.size.sm};
  line-height: 2;
`;
