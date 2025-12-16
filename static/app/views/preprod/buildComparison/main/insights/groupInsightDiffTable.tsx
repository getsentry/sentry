import {Fragment, useEffect, useState} from 'react';

import {Tag} from '@sentry/scraps/badge/tag';
import {Button, ButtonBar} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import TextOverflow from 'sentry/components/textOverflow';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  DiffTableChangeAmountCell,
  DiffTableHeader,
  DiffTableWithColumns,
  getDiffChangeElements,
  ITEMS_PER_PAGE,
  type DiffTableSort,
} from 'sentry/views/preprod/buildComparison/main/diffTable';
import type {DiffItem, DiffType} from 'sentry/views/preprod/types/appSizeTypes';
import {formattedSizeDiff} from 'sentry/views/preprod/utils/labelUtils';

const tableHeaders = [
  {
    key: 'type',
    label: 'Status',
  },
  {
    key: 'path',
    label: 'Affected Files',
  },
  {
    key: 'size_diff',
    label: 'Potential Savings',
  },
];

interface GroupInsightItemDiffTableProps {
  groupDiffItems: DiffItem[];
}

// This table is very similar to FileInsightItemDiffTable, but shows child items in a group. Should remain separate.
export function GroupInsightItemDiffTable({
  groupDiffItems,
}: GroupInsightItemDiffTableProps) {
  const [sort, setSort] = useState<DiffTableSort>({
    field: 'size_diff',
    kind: 'desc',
  });

  const [currentPage, setCurrentPage] = useState(0);

  // Sort just the parent items as before
  const sortedDiffItems = [...groupDiffItems].sort((a: DiffItem, b: DiffItem) => {
    const {field, kind} = sort;

    let aValue: number | string = '';
    let bValue: number | string = '';

    switch (field) {
      case 'type': {
        // Sort by type: added < modified < removed
        const order: Record<DiffType, number> = {
          added: 0,
          increased: 1,
          decreased: 2,
          removed: 3,
        };
        aValue = order[a.type];
        bValue = order[b.type];
        break;
      }
      case 'path':
        aValue = a.path || '';
        bValue = b.path || '';
        break;
      case 'size_diff':
        aValue = Math.abs(a.size_diff ?? 0);
        bValue = Math.abs(b.size_diff ?? 0);
        break;
      default:
        throw new Error(`Invalid field: ${field}`);
    }

    if (aValue < bValue) return kind === 'asc' ? -1 : 1;
    if (aValue > bValue) return kind === 'asc' ? 1 : -1;
    return 0;
  });

  /**
   * We want each page to have ITEMS_PER_PAGE total rows,
   * counting both parent and their child diff_items (if any).
   * But sortedDiffItems should only be the parent items.
   */
  function getPagedParentItems(items: DiffItem[], itemsPerPage: number, page: number) {
    const pagedParents: DiffItem[] = [];
    let runningRowCount = 0;
    let i = 0;
    // Skip parents/children from previous pages
    while (i < items.length && runningRowCount < page * itemsPerPage) {
      runningRowCount += 1; // count parent
      const childCount =
        items[i] && Array.isArray(items[i]!.diff_items)
          ? items[i]!.diff_items!.length
          : 0;
      runningRowCount += childCount; // count children
      i++;
    }
    // Reset runningRowCount for just this page
    runningRowCount = 0;
    // i points to first parent to be included on this page
    while (i < items.length && runningRowCount < itemsPerPage) {
      const parent = items[i];
      const childCount =
        parent && Array.isArray(parent.diff_items) ? parent.diff_items.length : 0;
      const totalRowsForParent = 1 + childCount;
      // If adding this parent would cross the page boundary (i.e., would not fit), break
      if (runningRowCount + totalRowsForParent > itemsPerPage) {
        break;
      }
      pagedParents.push(parent!);
      runningRowCount += totalRowsForParent;
      i++;
    }
    return pagedParents;
  }

  // Compute total "rows" (parent + children per parent)
  const totalRows = sortedDiffItems.reduce((count, parent) => {
    const childCount = Array.isArray(parent.diff_items) ? parent.diff_items.length : 0;
    return count + 1 + childCount;
  }, 0);

  const totalPages = Math.ceil(totalRows / ITEMS_PER_PAGE);
  const lastPageIndex = Math.max(totalPages - 1, 0);
  const safeCurrentPage = Math.min(currentPage, lastPageIndex);

  // For this page, get the diff parent items whose "rows" (including children) fill this page
  const currentDiffItems = getPagedParentItems(
    sortedDiffItems,
    ITEMS_PER_PAGE,
    safeCurrentPage
  );

  const showPagination = totalPages > 1;

  useEffect(() => {
    if (safeCurrentPage !== currentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage]);

  useEffect(() => {
    setCurrentPage(0);
  }, [sort.field, sort.kind, groupDiffItems.length]);

  const handlePageChange = (newPage: number) => {
    const clampedPage = Math.max(0, Math.min(newPage, lastPageIndex));
    setCurrentPage(clampedPage);
  };

  let rowIndex = 0;
  return (
    <Flex direction="column" gap="md">
      <DiffTableWithColumns gridTemplateColumns="150px minmax(200px, 3fr) 180px">
        <DiffTableHeader>
          {tableHeaders.map(header => (
            <SimpleTable.HeaderCell
              key={header.key}
              handleSortClick={
                header.key
                  ? () =>
                      setSort({
                        field: header.key,
                        kind:
                          sort?.field === header.key && sort.kind === 'asc'
                            ? 'desc'
                            : 'asc',
                      })
                  : undefined
              }
              sort={sort && sort?.field === header.key ? sort.kind : undefined}
            >
              {header.label}
            </SimpleTable.HeaderCell>
          ))}
        </DiffTableHeader>
        {sortedDiffItems.length === 0 && (
          <SimpleTable.Empty>
            <Stack gap="lg" align="center" justify="center">
              <Text size="lg" variant="muted" bold>
                {t('No results found')}
              </Text>
            </Stack>
          </SimpleTable.Empty>
        )}
        {currentDiffItems.map(groupDiffItem => {
          rowIndex++;
          const groupDiffItemChange = getDiffChangeElements(groupDiffItem);

          return (
            <Fragment key={rowIndex}>
              <SimpleTable.Row key={rowIndex}>
                <SimpleTable.RowCell>
                  <Tag icon={groupDiffItemChange.icon} type={groupDiffItemChange.type}>
                    {groupDiffItemChange.label}
                  </Tag>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell justify="start" style={{minWidth: 0}}>
                  <Tooltip
                    title={
                      groupDiffItem.path ? (
                        <Flex align="start" gap="xs">
                          <Text monospace>{groupDiffItem.path}</Text>
                          <CopyToClipboardButton
                            borderless
                            size="zero"
                            text={groupDiffItem.path}
                            style={{flexShrink: 0}}
                            aria-label="Copy path to clipboard"
                          />
                        </Flex>
                      ) : null
                    }
                    disabled={!groupDiffItem.path}
                    isHoverable
                    maxWidth={420}
                  >
                    <TextOverflow
                      ellipsisDirection="right"
                      style={{display: 'block', width: '100%'}}
                    >
                      <Text bold>{groupDiffItem.path ?? ''}</Text>
                    </TextOverflow>
                  </Tooltip>
                </SimpleTable.RowCell>
                <DiffTableChangeAmountCell changeType={groupDiffItem.type}>
                  {formattedSizeDiff(groupDiffItem.size_diff)}
                </DiffTableChangeAmountCell>
              </SimpleTable.Row>
              {groupDiffItem.diff_items?.map(diffItem => {
                const diffItemChange = getDiffChangeElements(diffItem);
                return (
                  <SimpleTable.Row key={++rowIndex}>
                    <SimpleTable.RowCell>
                      <Tag icon={diffItemChange.icon} type={diffItemChange.type}>
                        {diffItemChange.label}
                      </Tag>
                    </SimpleTable.RowCell>
                    <SimpleTable.RowCell justify="start" style={{minWidth: 0}}>
                      <Text variant="muted">{diffItem.path ?? ''}</Text>
                    </SimpleTable.RowCell>
                    <DiffTableChangeAmountCell changeType={diffItem.type}>
                      {formattedSizeDiff(diffItem.size_diff)}
                    </DiffTableChangeAmountCell>
                  </SimpleTable.Row>
                );
              })}
            </Fragment>
          );
        })}
      </DiffTableWithColumns>
      {showPagination && (
        <Flex align="center" justify="end" gap="md" padding="md">
          <Text size="sm" variant="muted">
            {t('Page %s of %s', safeCurrentPage + 1, totalPages)}
          </Text>
          <ButtonBar merged gap="0">
            <Button
              size="xs"
              icon={<IconChevron direction="left" />}
              aria-label={t('Previous')}
              onClick={() => handlePageChange(safeCurrentPage - 1)}
              disabled={safeCurrentPage === 0}
            />
            <Button
              size="xs"
              icon={<IconChevron direction="right" />}
              aria-label={t('Next')}
              onClick={() => handlePageChange(safeCurrentPage + 1)}
              disabled={safeCurrentPage >= lastPageIndex}
            />
          </ButtonBar>
        </Flex>
      )}
    </Flex>
  );
}
