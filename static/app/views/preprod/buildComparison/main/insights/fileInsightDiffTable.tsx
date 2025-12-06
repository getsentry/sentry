import {Fragment, useEffect, useState} from 'react';

import {Tag} from '@sentry/scraps/badge/tag';
import {Button, ButtonBar} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import TextOverflow from 'sentry/components/textOverflow';
import {IconAdd, IconChevron, IconFix, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {
  DiffTableChangeAmountCell,
  DiffTableHeader,
  DiffTableWithColumns,
  ITEMS_PER_PAGE,
  type DiffTableSort,
} from 'sentry/views/preprod/buildComparison/main/diffTable';
import type {DiffItem, DiffType} from 'sentry/views/preprod/types/appSizeTypes';

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

interface FileInsightItemDiffTableProps {
  fileDiffItems: DiffItem[];
}

// TODO: Test
export function FileInsightItemDiffTable({fileDiffItems}: FileInsightItemDiffTableProps) {
  const [sort, setSort] = useState<DiffTableSort>({
    field: 'size_diff',
    kind: 'desc',
  });

  const [currentPage, setCurrentPage] = useState(0);

  const sortedDiffItems = [...fileDiffItems].sort((a: DiffItem, b: DiffItem) => {
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
          unchanged: 4,
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

  const totalPages = Math.ceil(sortedDiffItems.length / ITEMS_PER_PAGE);
  const lastPageIndex = Math.max(totalPages - 1, 0);
  const safeCurrentPage = Math.min(currentPage, lastPageIndex);
  const startIndex = safeCurrentPage * ITEMS_PER_PAGE;
  // TODO: Handle child count
  const currentDiffItems = sortedDiffItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const showPagination = totalPages > 1;

  useEffect(() => {
    if (safeCurrentPage !== currentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage]);

  useEffect(() => {
    setCurrentPage(0);
  }, [sort.field, sort.kind, fileDiffItems.length]);

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
          let changeTypeLabel: string;
          let changeTypeIcon: React.ReactNode;
          let changeTypeTagType: 'success' | 'error' | 'warning';
          switch (groupDiffItem.type) {
            case 'added':
              changeTypeTagType = 'error';
              changeTypeLabel = t('Added');
              changeTypeIcon = <IconAdd />;
              break;
            case 'removed':
              changeTypeTagType = 'success';
              changeTypeLabel = t('Removed');
              changeTypeIcon = <IconSubtract />;
              break;
            default:
              changeTypeTagType = 'warning';
              changeTypeLabel = t('Unchanged');
              changeTypeIcon = <IconFix />;
              break;
          }

          return (
            <Fragment key={rowIndex}>
              <SimpleTable.Row key={rowIndex}>
                <SimpleTable.RowCell>
                  <Tag icon={changeTypeIcon} type={changeTypeTagType}>
                    {changeTypeLabel}
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
                      {groupDiffItem.path ?? ''}
                    </TextOverflow>
                  </Tooltip>
                </SimpleTable.RowCell>
                <DiffTableChangeAmountCell changeType={groupDiffItem.type}>
                  {groupDiffItem.size_diff > 0 ? '+' : '-'}
                  {formatBytesBase10(Math.abs(groupDiffItem.size_diff))}
                </DiffTableChangeAmountCell>
              </SimpleTable.Row>
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
