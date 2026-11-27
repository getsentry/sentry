import {parseAsInteger, useQueryState} from 'nuqs';

import {useTimezone} from '@sentry/scraps/dateTime';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Stack} from '@sentry/scraps/layout';
import {Pagination} from '@sentry/scraps/pagination';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {formatAnnotationTime} from 'sentry/components/charts/annotations/summarizeAnnotation';
import type {AnnotationItem} from 'sentry/components/charts/annotations/types';
import {getFlagActionLabel} from 'sentry/components/featureFlags/utils';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';

const PER_PAGE = 15;

const COLUMNS: TableColumnConfig[] = [
  {key: 'flag', width: 'minmax(0, 1fr)'},
  {key: 'action', width: 'max-content'},
  {key: 'time', width: 'minmax(0, max-content)'},
];

interface AnnotationFlagsTableProps {
  items: readonly AnnotationItem[];
  pageKeyName: string;
}

export function AnnotationFlagsTable({items, pageKeyName}: AnnotationFlagsTableProps) {
  const {selection} = usePageFilters();
  const userTimezone = useTimezone();
  const timezone = selection.datetime.utc ? 'UTC' : userTimezone;
  const [page, setPage] = useQueryState(
    pageKeyName,
    parseAsInteger.withDefault(0).withOptions({history: 'push'})
  );

  if (items.length === 0) {
    return (
      <EmptyState
        title={t('No flag changes')}
        description={t('There are no flag changes within this timeframe.')}
      />
    );
  }

  const rows = items
    .toSorted((a, b) => b.start - a.start)
    .slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  return (
    <Stack>
      <SimpleTable
        aria-label={t('Flag changes')}
        columns={COLUMNS}
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Feature Flag')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Action')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Date')}</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {rows.map(item => (
          <SimpleTable.Row key={item.id}>
            <SimpleTable.RowCell>
              <code>{item.title}</code>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              {item.action ? getFlagActionLabel(item.action) : null}
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text variant="muted">{formatAnnotationTime(item, timezone)}</Text>
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        ))}
      </SimpleTable>
      {items.length > PER_PAGE && (
        <Pagination
          previous={{cursor: String(page - 1), disabled: page === 0}}
          next={{
            cursor: String(page + 1),
            disabled: (page + 1) * PER_PAGE >= items.length,
          }}
          onCursor={cursor => void setPage(Number(cursor))}
        />
      )}
    </Stack>
  );
}
