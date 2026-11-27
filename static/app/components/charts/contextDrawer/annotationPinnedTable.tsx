import {useTimezone} from '@sentry/scraps/dateTime';
import {Flex} from '@sentry/scraps/layout';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {ANNOTATION_KIND_ICONS} from 'sentry/components/charts/annotations/kinds';
import {
  formatAnnotationTime,
  summarizeAnnotation,
} from 'sentry/components/charts/annotations/summarizeAnnotation';
import type {AnnotationItem} from 'sentry/components/charts/annotations/types';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';

const COLUMNS: TableColumnConfig[] = [
  {key: 'type', width: 'max-content'},
  {key: 'description', width: 'minmax(0, 1fr)'},
  {key: 'severity', width: 'max-content'},
  {key: 'time', width: 'minmax(0, max-content)'},
];

interface AnnotationPinnedTableProps {
  items: readonly AnnotationItem[];
}

export function AnnotationPinnedTable({items}: AnnotationPinnedTableProps) {
  const {selection} = usePageFilters();
  const userTimezone = useTimezone();
  const timezone = selection.datetime.utc ? 'UTC' : userTimezone;
  const rows = items.toSorted((a, b) => b.start - a.start);

  return (
    <SimpleTable
      aria-label={t('Pinned annotations')}
      columns={COLUMNS}
      header={
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell>{t('Type')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Description')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Severity')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Time')}</SimpleTable.HeaderCell>
        </SimpleTable.HeaderRow>
      }
    >
      {rows.map(item => {
        const {heading, description, tag} = summarizeAnnotation(item);
        const KindIcon = ANNOTATION_KIND_ICONS[item.kind];
        return (
          <SimpleTable.Row key={item.id}>
            <SimpleTable.RowCell>
              <Flex align="center" gap="sm">
                <KindIcon size="xs" variant="muted" />
                <Text>{heading}</Text>
              </Flex>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text>{description}</Text>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>{tag}</SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text variant="muted">{formatAnnotationTime(item, timezone)}</Text>
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        );
      })}
    </SimpleTable>
  );
}
