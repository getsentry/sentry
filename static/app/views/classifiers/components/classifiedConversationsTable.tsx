import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Pagination} from '@sentry/scraps/pagination';
import {COL_WIDTH_MINIMUM, COL_WIDTH_UNDEFINED} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {
  DataGrid,
  type GridColumnOrder,
  type GridColumnSort,
} from 'sentry/components/tables/dataGrid';
import {TableNoDataPanel} from 'sentry/components/tables/tableNoDataPanel';
import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {isCtrlKeyPressed} from 'sentry/utils/isCtrlKeyPressed';
import {getPaginationProps} from 'sentry/utils/pagination';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  useClassifiedConversations,
  type ClassifiedConversation,
  type ClassifiedConversationSortKey,
} from 'sentry/views/classifiers/hooks/useClassifiedConversations';
import {useClassifierResultFilter} from 'sentry/views/classifiers/hooks/useClassifierResultFilter';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';
import {getResultAttributeKey, isClassifierMatch} from 'sentry/views/classifiers/utils';
import {ConversationCell} from 'sentry/views/explore/conversations/components/conversationsTable';
import {getConversationDetailUrl} from 'sentry/views/explore/conversations/utils/urlParams';

import {ResultAttributeName} from './resultAttributeName';

type ColumnKey = 'conversation' | ClassifiedConversationSortKey;

const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  conversation: COL_WIDTH_UNDEFINED,
  result: 220,
  age: 110,
};

const FLEXIBLE_CONVERSATION_COLUMN = {
  conversation: `minmax(${COL_WIDTH_MINIMUM}px, 1fr)`,
};

function ClassifierResult({
  classifier,
  isBinary,
  value,
}: {
  classifier: TelemetryClassifier;
  isBinary: boolean;
  value: number | null;
}) {
  if (value === null) {
    return (
      <Text variant="muted" align="right">
        &mdash;
      </Text>
    );
  }
  if (isBinary) {
    const isMatch = isClassifierMatch(classifier, value);
    return (
      <Flex justify="end">
        <Tag variant={isMatch ? 'info' : 'muted'}>{isMatch ? t('True') : t('False')}</Tag>
      </Flex>
    );
  }
  return (
    <Text tabular align="right">
      {value}
    </Text>
  );
}

interface ClassifiedConversationsTableProps {
  classifier: TelemetryClassifier;
}

export function ClassifiedConversationsTable({
  classifier,
}: ClassifiedConversationsTableProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {data, isFetching, error, pageLinks, setCursor, sort, setSort} =
    useClassifiedConversations(classifier);
  const {isBinary, resultFilter} = useClassifierResultFilter(classifier);
  const [highlightedRowKey, setHighlightedRowKey] = useState<number | undefined>();
  const [columnWidths, setColumnWidths] = useState<Partial<Record<ColumnKey, number>>>(
    {}
  );

  const projects = useMemo(() => [Number(classifier.projectId)], [classifier.projectId]);

  const showResultColumn = resultFilter === 'all';

  const columnOrder = useMemo<Array<GridColumnOrder<ColumnKey>>>(
    () => [
      {
        key: 'conversation',
        name: t('Conversation'),
        width: columnWidths.conversation ?? DEFAULT_COLUMN_WIDTHS.conversation,
      },
      ...(showResultColumn
        ? [
            {
              key: 'result' as const,
              name: getResultAttributeKey(classifier.resultAttribute),
              width: columnWidths.result ?? DEFAULT_COLUMN_WIDTHS.result,
            },
          ]
        : []),
      {
        key: 'age',
        name: t('Age'),
        width: columnWidths.age ?? DEFAULT_COLUMN_WIDTHS.age,
      },
    ],
    [classifier.resultAttribute, columnWidths, showResultColumn]
  );

  const handleResizeColumn = useCallback(
    (_columnIndex: number, column: GridColumnOrder<ColumnKey>) => {
      setColumnWidths(current => ({...current, [column.key]: column.width}));
    },
    []
  );

  const staticColumnWidths =
    columnWidths.conversation === undefined ||
    columnWidths.conversation === COL_WIDTH_UNDEFINED
      ? FLEXIBLE_CONVERSATION_COLUMN
      : undefined;

  const getColumnSort = useCallback(
    (column: GridColumnOrder<ColumnKey>): GridColumnSort | undefined => {
      if (column.key === 'conversation') {
        return undefined;
      }
      const sortKey = column.key;
      let direction: 'asc' | 'desc' | undefined;
      if (sort === sortKey) {
        direction = 'asc';
      } else if (sort === `-${sortKey}`) {
        direction = 'desc';
      }
      return {
        align: 'right',
        direction,
        onSort: () => setSort(direction === 'desc' ? sortKey : `-${sortKey}`),
      };
    },
    [setSort, sort]
  );

  const renderHeadCell = useCallback(
    (column: GridColumnOrder<ColumnKey>) =>
      column.key === 'result' ? (
        <ResultAttributeName resultAttribute={classifier.resultAttribute} />
      ) : (
        column.name
      ),
    [classifier.resultAttribute]
  );

  const renderBodyCell = useCallback(
    (column: GridColumnOrder<ColumnKey>, row: ClassifiedConversation) => {
      switch (column.key) {
        case 'conversation':
          return <ConversationCell conversation={row.conversation} />;
        case 'result':
          return (
            <ClassifierResult
              classifier={classifier}
              isBinary={isBinary}
              value={row.result}
            />
          );
        case 'age':
          return (
            <Text align="right" variant="muted">
              {row.classifiedAt ? (
                <TimeSince unitStyle="extraShort" date={row.classifiedAt} />
              ) : (
                '—'
              )}
            </Text>
          );
        default:
          return null;
      }
    },
    [classifier, isBinary]
  );

  const handleRowClick = useCallback(
    (row: ClassifiedConversation, _key: number, event: React.MouseEvent) => {
      const url = getConversationDetailUrl(organization.slug, row.conversation, projects);
      if (event.shiftKey) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      if (isCtrlKeyPressed(event)) {
        window.open(url, '_blank');
        return;
      }
      navigate(url);
    },
    [navigate, organization.slug, projects]
  );

  return (
    <Stack gap="lg">
      <DataGrid
        isLoading={isFetching}
        error={error}
        data={data}
        emptyMessage={<TableNoDataPanel />}
        columnOrder={columnOrder}
        bodyStyle={{marginBottom: 0}}
        grid={{
          getColumnSort,
          renderHeadCell,
          renderBodyCell,
          onResizeColumn: handleResizeColumn,
          staticColumnWidths,
        }}
        onRowClick={handleRowClick}
        isRowClickable={() => true}
        onRowMouseOver={(_row, key) => setHighlightedRowKey(key)}
        onRowMouseOut={() => setHighlightedRowKey(undefined)}
        highlightedRowKey={highlightedRowKey}
      />
      <TablePagination {...getPaginationProps(pageLinks)} onCursor={setCursor} />
    </Stack>
  );
}

const TablePagination = styled(Pagination)`
  margin: 0;
`;
