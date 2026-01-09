import {useEffect, useState} from 'react';

import {Tag} from '@sentry/scraps/badge/tag';
import {Button} from '@sentry/scraps/button';
import {ButtonBar} from '@sentry/scraps/button/buttonBar';
import {Flex} from '@sentry/scraps/layout/flex';
import {Stack} from '@sentry/scraps/layout/stack';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import TextOverflow from 'sentry/components/textOverflow';
import {IconAdd, IconFix, IconSubtract} from 'sentry/icons';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {capitalize} from 'sentry/utils/string/capitalize';
import {
  DiffTableChangeAmountCell,
  DiffTableHeader,
  DiffTableWithColumns,
  ITEMS_PER_PAGE,
  type DiffTableSort,
} from 'sentry/views/preprod/buildComparison/main/diffTable';
import type {DiffItem, DiffType} from 'sentry/views/preprod/types/appSizeTypes';
import {formattedSizeDiff} from 'sentry/views/preprod/utils/labelUtils';

const tableHeaders = [
  {
    key: 'change',
    label: 'Change',
  },
  {
    key: 'file_path',
    label: 'File Path',
  },
  {
    key: 'item_type',
    label: 'Item Type',
  },
  {
    key: 'size',
    label: 'Size',
  },
  {
    key: 'size_diff',
    label: 'Size Diff',
  },
];

interface SizeCompareItemDiffTableProps {
  diffItems: DiffItem[];
  disableHideSmallChanges: () => void;
  originalItemCount: number;
}

export function SizeCompareItemDiffTable({
  diffItems,
  originalItemCount,
  disableHideSmallChanges,
}: SizeCompareItemDiffTableProps) {
  // Sort by diff initially
  const [sort, setSort] = useState<DiffTableSort>({
    field: 'size_diff',
    kind: 'desc',
  });

  const [currentPage, setCurrentPage] = useState(0);

  const sortedDiffItems = [...diffItems].sort((a: DiffItem, b: DiffItem) => {
    const {field, kind} = sort;

    let aValue: number | string = '';
    let bValue: number | string = '';

    switch (field) {
      case 'change': {
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
      case 'item_type':
        aValue = a.item_type || '';
        bValue = b.item_type || '';
        break;
      case 'file_path':
        aValue = a.path || '';
        bValue = b.path || '';
        break;
      case 'size':
        aValue = a.head_size ?? a.base_size ?? 0;
        bValue = b.head_size ?? b.base_size ?? 0;
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
  const currentDiffItems = sortedDiffItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const showPagination = totalPages > 1;

  useEffect(() => {
    if (safeCurrentPage !== currentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage]);

  useEffect(() => {
    setCurrentPage(0);
  }, [sort.field, sort.kind, diffItems.length]);

  const handlePageChange = (newPage: number) => {
    const clampedPage = Math.max(0, Math.min(newPage, lastPageIndex));
    setCurrentPage(clampedPage);
  };

  return (
    <Flex direction="column" gap="md">
      <DiffTableWithColumns gridTemplateColumns="150px minmax(200px, 3fr) 120px 120px 120px">
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
              {originalItemCount > 0 && (
                <Button priority="primary" onClick={disableHideSmallChanges}>
                  {t('Show all changes')}
                </Button>
              )}
            </Stack>
          </SimpleTable.Empty>
        )}
        {currentDiffItems.map((diffItem, index) => {
          let changeTypeLabel: string;
          let changeTypeIcon: React.ReactNode;
          let changeTypeTagType: 'success' | 'danger' | 'warning';
          switch (diffItem.type) {
            case 'added':
              changeTypeTagType = 'danger';
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
              changeTypeLabel = t('Modified');
              changeTypeIcon = <IconFix />;
              break;
          }

          return (
            <SimpleTable.Row key={startIndex + index}>
              <SimpleTable.RowCell>
                <Tag icon={changeTypeIcon} variant={changeTypeTagType}>
                  {changeTypeLabel}
                </Tag>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell justify="start" style={{minWidth: 0}}>
                <Tooltip
                  title={
                    diffItem.path ? (
                      <Flex align="center" gap="xs">
                        <Text wordBreak="break-all" monospace>
                          {diffItem.path}
                        </Text>
                        <CopyToClipboardButton
                          borderless
                          size="zero"
                          text={diffItem.path}
                          style={{flexShrink: 0}}
                          aria-label="Copy path to clipboard"
                        />
                      </Flex>
                    ) : null
                  }
                  disabled={!diffItem.path}
                  isHoverable
                  maxWidth={420}
                >
                  <TextOverflow
                    ellipsisDirection="right"
                    style={{display: 'block', width: '100%'}}
                  >
                    {diffItem.path ?? ''}
                  </TextOverflow>
                </Tooltip>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                {capitalize(diffItem.item_type ?? '')}
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                {typeof diffItem.head_size === 'number'
                  ? formatBytesBase10(diffItem.head_size)
                  : typeof diffItem.base_size === 'number'
                    ? formatBytesBase10(diffItem.base_size)
                    : '-'}
              </SimpleTable.RowCell>
              <DiffTableChangeAmountCell changeType={diffItem.type}>
                {formattedSizeDiff(diffItem.size_diff)}
              </DiffTableChangeAmountCell>
            </SimpleTable.Row>
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
