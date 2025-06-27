import {Fragment, useMemo, useRef} from 'react';

import {Tooltip} from 'sentry/components/core/tooltip';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {GridResizer} from 'sentry/components/tables/gridEditable/styles';
import {IconArrow, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {
  Table,
  TableHead,
  TableHeadCell,
  TableHeadCellContent,
  TableStatus,
  useTableStyles,
} from 'sentry/views/explore/components/table';
import {useLogsPageData} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  useLogsFields,
  useLogsIsTableFrozen,
  useLogsSearch,
  useLogsSortBys,
  useSetLogsCursor,
  useSetLogsSortBys,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_INSTRUCTIONS_URL} from 'sentry/views/explore/logs/constants';
import {
  FirstTableHeadCell,
  LogTableBody,
  LogTableRow,
} from 'sentry/views/explore/logs/styles';
import {LogRowContent} from 'sentry/views/explore/logs/tables/logsTableRow';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {
  getLogBodySearchTerms,
  getTableHeaderLabel,
  logsFieldAlignment,
} from 'sentry/views/explore/logs/utils';
import {EmptyStateText} from 'sentry/views/traces/styles';

type LogsTableProps = {
  allowPagination?: boolean;
  numberAttributes?: TagCollection;
  showHeader?: boolean;
  stringAttributes?: TagCollection;
};

export function LogsTable({
  showHeader = true,
  allowPagination = true,
  stringAttributes,
  numberAttributes,
}: LogsTableProps) {
  const fields = useLogsFields();
  const search = useLogsSearch();
  const setCursor = useSetLogsCursor();
  const isTableFrozen = useLogsIsTableFrozen();

  const {data, isError, isPending, pageLinks, meta} = useLogsPageData().logsQueryResult;

  const tableRef = useRef<HTMLTableElement>(null);
  const sharedHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const {initialTableStyles, onResizeMouseDown} = useTableStyles(fields, tableRef, {
    minimumColumnWidth: 50,
    prefixColumnWidth: 'min-content',
    staticColumnWidths: {
      [OurLogKnownFieldKey.MESSAGE]: '1fr',
    },
  });

  const isEmpty = !isPending && !isError && (data?.length ?? 0) === 0;
  const highlightTerms = useMemo(() => getLogBodySearchTerms(search), [search]);
  const sortBys = useLogsSortBys();
  const setSortBys = useSetLogsSortBys();

  return (
    <Fragment>
      <Table
        ref={tableRef}
        style={initialTableStyles}
        data-test-id="logs-table"
        hideBorder={isTableFrozen}
        showVerticalScrollbar={isTableFrozen}
      >
        {showHeader ? (
          <TableHead>
            <LogTableRow>
              <FirstTableHeadCell isFirst align="left">
                <TableHeadCellContent isFrozen />
              </FirstTableHeadCell>
              {fields.map((field, index) => {
                const direction = sortBys.find(s => s.field === field)?.kind;

                const fieldType = meta?.fields?.[field];
                const align = logsFieldAlignment(field, fieldType);
                const headerLabel = getTableHeaderLabel(
                  field,
                  stringAttributes,
                  numberAttributes
                );

                if (isPending) {
                  return <TableHeadCell key={index} isFirst={index === 0} />;
                }
                return (
                  <TableHeadCell
                    align={index === 0 ? 'left' : align}
                    key={index}
                    isFirst={index === 0}
                  >
                    <TableHeadCellContent
                      onClick={isTableFrozen ? undefined : () => setSortBys([{field}])}
                      isFrozen={isTableFrozen}
                    >
                      <Tooltip showOnlyOnOverflow title={headerLabel}>
                        {headerLabel}
                      </Tooltip>
                      {defined(direction) && (
                        <IconArrow
                          size="xs"
                          direction={
                            direction === 'desc'
                              ? 'down'
                              : direction === 'asc'
                                ? 'up'
                                : undefined
                          }
                        />
                      )}
                    </TableHeadCellContent>
                    {index !== fields.length - 1 && (
                      <GridResizer
                        dataRows={!isError && !isPending && data ? data.length : 0}
                        onMouseDown={e => onResizeMouseDown(e, index)}
                      />
                    )}
                  </TableHeadCell>
                );
              })}
            </LogTableRow>
          </TableHead>
        ) : null}
        <LogTableBody showHeader={showHeader}>
          {isPending && (
            <TableStatus>
              <LoadingIndicator />
            </TableStatus>
          )}
          {isError && (
            <TableStatus>
              <IconWarning color="gray300" size="lg" />
            </TableStatus>
          )}
          {isEmpty && (
            <TableStatus>
              <EmptyStateWarning withIcon>
                <EmptyStateText size="xl">{t('No logs found')}</EmptyStateText>
                <EmptyStateText size="md">
                  {tct(
                    'Try adjusting your filters or get started with sending logs by checking these [instructions]',
                    {
                      instructions: (
                        <ExternalLink href={LOGS_INSTRUCTIONS_URL}>
                          {t('instructions')}
                        </ExternalLink>
                      ),
                    }
                  )}
                </EmptyStateText>
              </EmptyStateWarning>
            </TableStatus>
          )}
          {data?.map((row, index) => (
            <LogRowContent
              dataRow={row}
              meta={meta}
              highlightTerms={highlightTerms}
              sharedHoverTimeoutRef={sharedHoverTimeoutRef}
              key={index}
            />
          ))}
        </LogTableBody>
      </Table>
      {allowPagination ? <Pagination pageLinks={pageLinks} onCursor={setCursor} /> : null}
    </Fragment>
  );
}
