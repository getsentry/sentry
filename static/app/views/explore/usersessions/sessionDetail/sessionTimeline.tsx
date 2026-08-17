import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Table, type TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {SortDirection} from 'sentry/components/tables/sortableHeaderCell';
import {IconChevron} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {getShortEventId} from 'sentry/utils/events';
import type {TagVariant} from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SESSION_DATASETS} from 'sentry/views/explore/usersessions/datasets';
import type {SessionDatasetKey} from 'sentry/views/explore/usersessions/datasets';

import {getTraceLink, ROW_CONFIG} from './rowConfig';
import type {
  SessionEvent,
  SessionTimelineItem,
  SessionTraceGroup,
} from './useSessionDetail';

const COLUMNS: TableColumnConfig[] = [
  {key: 'timestamp', width: 220},
  {key: 'type', width: 110},
  {key: 'title'},
  {key: 'detail', width: 160},
];

const HEADERS: Record<string, string> = {
  timestamp: t('Timestamp'),
  type: t('Type'),
  title: t('Title'),
  detail: t('Detail'),
};

// Each row is one item, so the tag reads singular: "Log", not "Logs". The color
// comes from the dataset config so the type stays one hue everywhere.
const TAGS = Object.fromEntries(
  SESSION_DATASETS.map(config => [
    config.key,
    {label: config.singularLabel, variant: config.tagVariant},
  ])
) as Record<SessionDatasetKey, {label: string; variant: TagVariant}>;

// A trace row stands in for its spans, so it borrows their hue.
const TRACE_TAG = {label: t('Trace'), variant: TAGS.spans.variant};

/**
 * Identifies a group by its members rather than by position, so expansion
 * survives a re-sort (which reverses a run but keeps its membership) and stays
 * unique when one trace shows up in more than one run.
 */
function groupKey(group: SessionTraceGroup): string {
  return [group.trace, ...group.spans.map(span => String(span.row.id)).sort()].join('-');
}

interface Props {
  dateParams: Record<string, any>;
  isError: boolean;
  /** True when a filter is hiding rows, which changes what an empty table means. */
  isFiltered: boolean;
  isPending: boolean;
  items: SessionTimelineItem[];
  onToggleSort: () => void;
  sortDirection: SortDirection;
}

export function SessionTimeline({
  items,
  isFiltered,
  isPending,
  isError,
  dateParams,
  sortDirection,
  onToggleSort,
}: Props) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  function toggleGroup(key: string) {
    setExpanded(current => {
      const next = new Set(current);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <StyledTable columns={COLUMNS}>
      <Table.Head>
        <Table.Row>
          {COLUMNS.map(column => {
            // Timestamp is the only sortable column: the rest are merged across
            // four datasets, and no single query can order them.
            const isSortable = column.key === 'timestamp';
            return (
              <Table.HeadCell
                key={column.key}
                column={column.key}
                sort={isSortable ? sortDirection : undefined}
                onSort={isSortable ? onToggleSort : undefined}
              >
                {HEADERS[column.key]}
              </Table.HeadCell>
            );
          })}
        </Table.Row>
      </Table.Head>
      {isError ? (
        <Table.StatusBody>
          <LoadingError message={t('Failed to load session telemetry.')} />
        </Table.StatusBody>
      ) : isPending ? (
        <Table.StatusBody>
          <LoadingIndicator />
        </Table.StatusBody>
      ) : items.length === 0 ? (
        <Table.StatusBody>
          <Text variant="muted">
            {isFiltered
              ? t('No telemetry matches these filters.')
              : t('No telemetry found for this session.')}
          </Text>
        </Table.StatusBody>
      ) : (
        <Table.Body>
          {items.map((item, index) => {
            if (item.kind === 'event') {
              return (
                <EventRow
                  key={`event-${index}`}
                  event={item.event}
                  dateParams={dateParams}
                />
              );
            }

            const key = groupKey(item.group);
            const isExpanded = expanded.has(key);
            return (
              <Fragment key={`trace-${index}`}>
                <TraceRow
                  group={item.group}
                  isExpanded={isExpanded}
                  onToggle={() => toggleGroup(key)}
                />
                {isExpanded &&
                  item.group.spans.map((span, spanIndex) => (
                    <EventRow
                      key={`${key}-${spanIndex}`}
                      event={span}
                      dateParams={dateParams}
                      isNested
                    />
                  ))}
              </Fragment>
            );
          })}
        </Table.Body>
      )}
    </StyledTable>
  );
}

/**
 * One run of same-trace spans. It links to the trace rather than to any single
 * span; the spans themselves are one click away.
 */
function TraceRow({
  group,
  isExpanded,
  onToggle,
}: {
  group: SessionTraceGroup;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const organization = useOrganization();
  const location = useLocation();
  const leadingSpan = group.spans[0]!;
  const link = getTraceLink(leadingSpan.row, {organization, location});
  const title = t('Trace %s', getShortEventId(group.trace));

  return (
    <Table.Row divider>
      <TimestampCell timestamp={group.timestamp}>
        <Button
          size="zero"
          variant="transparent"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? t('Collapse trace') : t('Expand trace')}
          icon={<IconChevron direction={isExpanded ? 'down' : 'right'} size="xs" />}
          onClick={onToggle}
        />
      </TimestampCell>
      <Table.Cell>
        <Tag variant={TRACE_TAG.variant}>{TRACE_TAG.label}</Tag>
      </Table.Cell>
      <TitleCell title={title} tooltip={group.trace} link={link} />
      <Table.Cell>
        <Text variant="muted" size="sm" ellipsis>
          {tn('%s span', '%s spans', group.spans.length)}
        </Text>
      </Table.Cell>
    </Table.Row>
  );
}

function EventRow({
  event,
  dateParams,
  isNested,
}: {
  dateParams: Record<string, any>;
  event: SessionEvent;
  isNested?: boolean;
}) {
  const organization = useOrganization();
  const location = useLocation();
  const link = ROW_CONFIG[event.key].getLink(event.row, {
    organization,
    location,
    dateParams,
  });

  return (
    <Table.Row divider>
      <TimestampCell timestamp={event.timestamp} isNested={isNested} />
      <Table.Cell>
        <Tag variant={TAGS[event.key].variant}>{TAGS[event.key].label}</Tag>
      </Table.Cell>
      <TitleCell title={event.title} tooltip={event.title} link={link} />
      <Table.Cell>
        <Text variant="muted" size="sm" ellipsis>
          {event.detail ?? ''}
        </Text>
      </Table.Cell>
    </Table.Row>
  );
}

/**
 * The leading cell. Every row reserves the chevron's slot whether or not it can
 * expand, so the timestamps read as one column; nested rows shift the whole cell
 * to sit under their trace.
 */
function TimestampCell({
  timestamp,
  isNested,
  children,
}: {
  timestamp: number | undefined;
  children?: React.ReactNode;
  isNested?: boolean;
}) {
  return (
    <Table.Cell>
      <Flex align="center" gap="xs" paddingLeft={isNested ? 'xl' : undefined}>
        <Gutter>{children}</Gutter>
        {timestamp === undefined ? (
          <Text variant="muted">{'—'}</Text>
        ) : (
          <Text tabular size="sm">
            <DateTime date={timestamp} seconds timeZone />
          </Text>
        )}
      </Flex>
    </Table.Cell>
  );
}

function TitleCell({
  title,
  tooltip,
  link,
}: {
  link: LocationDescriptor | undefined;
  title: string;
  tooltip: string;
}) {
  return (
    <Table.Cell>
      {link ? (
        // `variant="inherit"` matters: Text otherwise paints content.primary and
        // swallows the anchor's accent color, leaving the link looking like plain
        // text.
        <TruncatedLink to={link}>
          <Text ellipsis size="sm" variant="inherit" title={tooltip}>
            {title}
          </Text>
        </TruncatedLink>
      ) : (
        <Text ellipsis size="sm" title={tooltip}>
          {title}
        </Text>
      )}
    </Table.Cell>
  );
}

/** Fits a `size="zero"` icon button exactly, so an empty slot costs the same. */
const Gutter = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
`;

/**
 * An anchor is a flex item with `min-width: auto`, so it refuses to shrink below
 * its text and overflows the cell. Zeroing that hands the truncation back to the
 * `Text` inside.
 */
const TruncatedLink = styled(Link)`
  min-width: 0;
`;

const StyledTable = styled(Table)`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};

  th,
  td {
    display: flex;
    align-items: center;
    padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
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
