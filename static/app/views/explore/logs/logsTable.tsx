import {Fragment, useRef} from 'react';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {GridResizer} from 'sentry/components/gridEditable/styles';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {Tooltip} from 'sentry/components/tooltip';
import {LOGS_PROPS_DOCS_URL} from 'sentry/constants';
import {IconArrow, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {
  Table,
  TableBody,
  TableHead,
  TableHeadCell,
  TableHeadCellContent,
  TableRow,
  TableStatus,
  useTableStyles,
} from 'sentry/views/explore/components/table';
import {
  useLogsFields,
  useLogsIsTableEditingFrozen,
  useLogsSearch,
  useLogsSortBys,
  useSetLogsCursor,
  useSetLogsSortBys,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LogRowContent} from 'sentry/views/explore/logs/logsTableRow';
import type {UseExploreLogsTableResult} from 'sentry/views/explore/logs/useLogsQuery';
import {EmptyStateText} from 'sentry/views/traces/styles';

import {getLogBodySearchTerms, getTableHeaderLabel, logsFieldAlignment} from './utils';

export function LogsTable({tableData}: {tableData: UseExploreLogsTableResult}) {
  const fields = useLogsFields();
  const search = useLogsSearch();
  const setCursor = useSetLogsCursor();
  const isTableEditingFrozen = useLogsIsTableEditingFrozen();
  const {data, isError, isPending, pageLinks, meta} = tableData;

  const tableRef = useRef<HTMLTableElement>(null);
  const sharedHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const {initialTableStyles, onResizeMouseDown} = useTableStyles(fields, tableRef, {
    minimumColumnWidth: 50,
  });

  const isEmpty = !isPending && !isError && (data?.length ?? 0) === 0;
  const highlightTerms = getLogBodySearchTerms(search);
  const sortBys = useLogsSortBys();
  const setSortBys = useSetLogsSortBys();

  return (
    <Fragment>
      <Table ref={tableRef} styles={initialTableStyles}>
        <TableHead>
          <TableRow>
            {fields.map((field, index) => {
              const direction = sortBys.find(s => s.field === field)?.kind;

              const fieldType = meta?.fields?.[field];
              const align = logsFieldAlignment(field, fieldType);
              const headerLabel = getTableHeaderLabel(field);

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
                    onClick={
                      isTableEditingFrozen ? undefined : () => setSortBys([{field}])
                    }
                    isFrozen={isTableEditingFrozen}
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
          </TableRow>
        </TableHead>
        <TableBody>
          {isPending && (
            <TableRow>
              <TableStatus>
                <LoadingIndicator />
              </TableStatus>
            </TableRow>
          )}
          {isError && (
            <TableRow>
              <TableStatus>
                <IconWarning color="gray300" size="lg" />
              </TableStatus>
            </TableRow>
          )}
          {isEmpty && (
            <TableRow>
              <TableStatus>
                <EmptyStateWarning withIcon>
                  <EmptyStateText size="fontSizeExtraLarge">
                    {t('No logs found')}
                  </EmptyStateText>
                  <EmptyStateText size="fontSizeMedium">
                    {tct('Try adjusting your filters or refer to [docSearchProps].', {
                      docSearchProps: (
                        <ExternalLink href={LOGS_PROPS_DOCS_URL}>
                          {t('docs for search properties')}
                        </ExternalLink>
                      ),
                    })}
                  </EmptyStateText>
                </EmptyStateWarning>
              </TableStatus>
            </TableRow>
          )}
          {data?.map((row, index) => (
            <TableRow key={index}>
              <LogRowContent
                dataRow={row}
                meta={meta}
                highlightTerms={highlightTerms}
                sharedHoverTimeoutRef={sharedHoverTimeoutRef}
              />
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination pageLinks={pageLinks} onCursor={setCursor} />
    </Fragment>
  );
}
