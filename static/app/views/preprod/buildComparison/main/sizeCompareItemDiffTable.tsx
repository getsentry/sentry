import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout/stack';
import {Text} from '@sentry/scraps/text';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Flex} from 'sentry/components/core/layout/flex';
import {Tooltip} from 'sentry/components/core/tooltip';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import TextOverflow from 'sentry/components/textOverflow';
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
  disableHideSmallChanges: () => void;
  originalItemCount: number;
}

export function SizeCompareItemDiffTable({
  diffItems,
  originalItemCount,
  disableHideSmallChanges,
}: SizeCompareItemDiffTableProps) {
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
            <SimpleTable.RowCell justify="start" style={{minWidth: 0}}>
              <Tooltip
                title={
                  diffItem.path ? (
                    <Flex
                      align="start"
                      gap="xs"
                      style={{maxWidth: '100%', textAlign: 'left'}}
                    >
                      <FilePathTooltipText>{diffItem.path}</FilePathTooltipText>
                      <CopyToClipboardButton
                        borderless
                        size="zero"
                        text={diffItem.path}
                        style={{flexShrink: 0}}
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
  overflow-x: auto;
  overflow-y: auto;
  grid-template-columns: 150px minmax(200px, 3fr) 120px 120px 120px;
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

const FilePathTooltipText = styled('span')`
  flex: 1;
  overflow-wrap: break-word;
  word-break: break-all;
  white-space: normal;
  user-select: text;
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
