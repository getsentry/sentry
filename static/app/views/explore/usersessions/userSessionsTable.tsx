import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Table, type TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {Duration} from 'sentry/components/duration/duration';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {SESSION_DATASETS} from './datasets';
import {SessionBadge} from './sessionBadge';
import {USER_SESSIONS_SUB_PATH} from './settings';
import type {UserSession} from './useUserSessions';

const COLUMNS: TableColumnConfig[] = [
  {key: 'session', width: 320},
  {key: 'total'},
  ...SESSION_DATASETS.map(config => ({key: config.key})),
  {key: 'duration'},
  {key: 'lastSeen'},
];

const HEADERS: Record<string, string> = {
  session: t('Session'),
  total: t('Telemetry'),
  ...Object.fromEntries(SESSION_DATASETS.map(config => [config.key, config.label])),
  duration: t('Duration'),
  lastSeen: t('Last Seen'),
};

interface Props {
  isError: boolean;
  isPending: boolean;
  sessions: UserSession[];
  /** Active search query, which changes what an empty result means. */
  query?: string;
  /** Query keys no dataset knows about — the usual cause of an empty result. */
  unrecognizedKeys?: string[];
}

export function UserSessionsTable({
  sessions,
  isPending,
  isError,
  query,
  unrecognizedKeys,
}: Props) {
  return (
    <StyledTable columns={COLUMNS}>
      <Table.Head>
        <Table.Row>
          {COLUMNS.map(column => (
            <Table.HeadCell key={column.key} column={column.key}>
              {HEADERS[column.key]}
            </Table.HeadCell>
          ))}
        </Table.Row>
      </Table.Head>
      {isError ? (
        <Table.StatusBody>
          <LoadingError message={t('Failed to load sessions.')} />
        </Table.StatusBody>
      ) : isPending ? (
        <Table.StatusBody>
          <LoadingIndicator />
        </Table.StatusBody>
      ) : sessions.length === 0 ? (
        <Table.StatusBody>
          <Stack gap="xs" align="center">
            <Text variant="muted">
              {query
                ? t('No sessions match this search.')
                : t(
                    'No sessions found. Nothing in this time range carries a session.id.'
                  )}
            </Text>
            {unrecognizedKeys?.length ? (
              <Text variant="muted" size="sm">
                {unrecognizedKeys.length === 1
                  ? t(
                      'No telemetry in this time range has the attribute %s.',
                      unrecognizedKeys[0]
                    )
                  : t(
                      'No telemetry in this time range has these attributes: %s.',
                      unrecognizedKeys.join(', ')
                    )}
              </Text>
            ) : null}
          </Stack>
        </Table.StatusBody>
      ) : (
        <Table.Body>
          {sessions.map(session => (
            <SessionRow key={session.id} session={session} />
          ))}
        </Table.Body>
      )}
    </StyledTable>
  );
}

function SessionRow({session}: {session: UserSession}) {
  const organization = useOrganization();
  const durationMs =
    session.firstSeen === undefined || session.lastSeen === undefined
      ? undefined
      : session.lastSeen - session.firstSeen;

  return (
    <Table.Row divider>
      <Table.Cell>
        <Link
          to={{
            pathname: `/organizations/${organization.slug}/explore/${USER_SESSIONS_SUB_PATH}/${session.id}/`,
          }}
        >
          {/*
            The badge's subject text uses `variant="inherit"`: Text otherwise
            paints content.primary and swallows the anchor's accent color,
            leaving the link looking like plain text.
          */}
          <SessionBadge name={session.name} />
        </Link>
      </Table.Cell>
      <Table.Cell>
        <Text tabular>{session.totalEvents.toLocaleString()}</Text>
      </Table.Cell>
      {SESSION_DATASETS.map(config => {
        const count = session.counts[config.key];
        return (
          <Table.Cell key={config.key}>
            <Text tabular variant={count === 0 ? 'muted' : undefined}>
              {count.toLocaleString()}
            </Text>
          </Table.Cell>
        );
      })}
      <Table.Cell>
        {durationMs === undefined ? (
          <Text variant="muted">{'—'}</Text>
        ) : (
          <Duration duration={[durationMs, 'ms']} precision="sec" />
        )}
      </Table.Cell>
      <Table.Cell>
        {session.lastSeen === undefined ? (
          <Text variant="muted">{'—'}</Text>
        ) : (
          <TimeSince date={session.lastSeen} />
        )}
      </Table.Cell>
    </Table.Row>
  );
}

const StyledTable = styled(Table)`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};

  th,
  td {
    display: flex;
    align-items: center;
    padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  }

  /* The session name leads; every numeric/temporal column right-aligns. */
  th:not(:first-of-type),
  td:not(:first-of-type) {
    justify-content: flex-end;
  }

  /* The badge ellipsizes its subject, which only works if every link in the
     flex chain above it is allowed to shrink below its content width. */
  td:first-of-type,
  td:first-of-type > a {
    min-width: 0;
  }

  thead {
    background: ${p => p.theme.tokens.background.secondary};
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
    border-radius: ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0 0;
  }

  /* Reinforce that rows lead somewhere; the accent link is the primary signal. */
  tbody tr:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }

  tbody tr:hover a {
    text-decoration: underline;
  }
`;
