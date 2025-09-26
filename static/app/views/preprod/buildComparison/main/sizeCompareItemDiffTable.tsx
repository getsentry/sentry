import {useState} from 'react';
import styled from '@emotion/styled';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconAdd, IconFix, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {capitalize} from 'sentry/utils/string/capitalize';
import type {DiffItem, DiffType} from 'sentry/views/preprod/types/appSizeTypes';

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

type Sort = {
  field: string;
  kind: 'asc' | 'desc';
};

interface SizeCompareItemDiffTableProps {
  diffItems: DiffItem[];
}

export function SizeCompareItemDiffTable({diffItems}: SizeCompareItemDiffTableProps) {
  // Sort by diff initially
  const [sort, setSort] = useState<Sort>({
    field: 'size_diff',
    kind: 'desc',
  });

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

  return (
    <SimpleTableWithColumns>
      <SimpleTableHeader>
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
      </SimpleTableHeader>
      {sortedDiffItems.length === 0 && (
        <SimpleTable.Empty>{t('No items changed')}</SimpleTable.Empty>
      )}
      {sortedDiffItems.map((diffItem, index) => {
        let changeTypeLabel: string;
        let changeTypeIcon: React.ReactNode;
        switch (diffItem.type) {
          case 'added':
            changeTypeLabel = t('Added');
            changeTypeIcon = <IconAdd />;
            break;
          case 'removed':
            changeTypeLabel = t('Removed');
            changeTypeIcon = <IconSubtract />;
            break;
          default:
            changeTypeLabel = t('Modified');
            changeTypeIcon = <IconFix />;
            break;
        }

        return (
          <SimpleTable.Row key={index}>
            <SimpleTable.RowCell>
              <ChangeTag changeType={diffItem.type}>
                {changeTypeIcon}
                {changeTypeLabel}
              </ChangeTag>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>{diffItem.path}</SimpleTable.RowCell>
            <SimpleTable.RowCell>
              {capitalize(diffItem.item_type ?? '')}
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              {diffItem.head_size
                ? formatBytesBase10(diffItem.head_size)
                : formatBytesBase10(diffItem.base_size!)}
            </SimpleTable.RowCell>
            <ChangeAmountCell changeType={diffItem.type}>
              {diffItem.size_diff > 0 ? '+' : '-'}
              {formatBytesBase10(Math.abs(diffItem.size_diff))}
            </ChangeAmountCell>
          </SimpleTable.Row>
        );
      })}
    </SimpleTableWithColumns>
  );
}

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: 0.5fr 3fr 0.5fr 0.5fr 0.5fr;
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  border-left: 0px;
  border-right: 0px;
`;

const SimpleTableHeader = styled(SimpleTable.Header)`
  border-radius: 0;
  border-left: 0px;
  border-right: 0px;
`;

const ChangeTag = styled('span')<{changeType: DiffType}>`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  border-radius: 3px;
  font-size: ${p => p.theme.fontSize.sm};
  background-color: ${p => {
    switch (p.changeType) {
      case 'increased':
      case 'decreased':
        return p.theme.warningFocus + '14'; // Add transparency (14 = 7% opacity)
      case 'added':
        return p.theme.dangerFocus + '14'; // Add transparency (14 = 7% opacity)
      case 'removed':
        return p.theme.successFocus + '14'; // Add transparency (14 = 7% opacity)
      default:
        throw new Error(`Invalid change type: ${p.changeType}`);
    }
  }};
  color: ${p => {
    switch (p.changeType) {
      case 'increased':
      case 'decreased':
        return p.theme.warningText;
      case 'added':
        return p.theme.dangerText;
      case 'removed':
        return p.theme.successText;
      default:
        throw new Error(`Invalid change type: ${p.changeType}`);
    }
  }};
`;

const ChangeAmountCell = styled(SimpleTable.RowCell)<{changeType: DiffType}>`
  align-items: end;
  color: ${p => {
    switch (p.changeType) {
      case 'increased':
      case 'decreased':
        return p.theme.warningText;
      case 'added':
        return p.theme.dangerText;
      case 'removed':
        return p.theme.successText;
      default:
        throw new Error(`Invalid change type: ${p.changeType}`);
    }
  }};
`;
