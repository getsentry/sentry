import type {ComponentProps, HTMLAttributes, ReactNode} from 'react';
import styled from '@emotion/styled';

import {Container, type FlexProps} from '@sentry/scraps/layout';
import {COL_WIDTH_MINIMUM, type TableColumnConfig} from '@sentry/scraps/table';

import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {COLUMN_BREAKPOINTS} from 'sentry/views/issueList/actions/utils';
import {
  useOptionalIssueSelectionActions,
  useOptionalIssueSelectionSummary,
} from 'sentry/views/issueList/issueSelectionContext';

type StreamGroupColumnKey =
  | 'select'
  | 'issue'
  | 'lastSeen'
  | 'firstSeen'
  | 'graph'
  | 'reprocessingStarted'
  | 'reprocessingEvents'
  | 'reprocessingProgress'
  | 'event'
  | 'users'
  | 'priority'
  | 'assignee';

export interface StreamGroupColumn extends TableColumnConfig {
  key: StreamGroupColumnKey;
  followsSelect?: boolean;
}

interface StreamGroupColumnOptions {
  canSelect: boolean;
  displayReprocessingLayout: boolean;
  withChart: boolean;
  withColumns: GroupListColumn[];
}

function getStreamGroupColumns({
  canSelect,
  displayReprocessingLayout,
  withChart,
  withColumns,
}: StreamGroupColumnOptions): StreamGroupColumn[] {
  const columns: StreamGroupColumn[] = [];

  if (canSelect) {
    columns.push({key: 'select', width: 'max-content'});
  }

  columns.push({key: 'issue', width: 'minmax(0, 1fr)', followsSelect: canSelect});

  if (withColumns.includes('lastSeen')) {
    columns.push({
      key: 'lastSeen',
      width: 102,
      visible: {[COLUMN_BREAKPOINTS.LAST_SEEN]: true},
    });
  }

  if (withColumns.includes('firstSeen')) {
    columns.push({
      key: 'firstSeen',
      width: COL_WIDTH_MINIMUM,
      visible: {[COLUMN_BREAKPOINTS.FIRST_SEEN]: true},
    });
  }

  if (displayReprocessingLayout) {
    columns.push(
      {key: 'reprocessingStarted', width: {zero: 117, xl: 172}},
      {key: 'reprocessingEvents', width: {zero: 107, xl: 172}},
      {key: 'reprocessingProgress', width: 192, visible: {xl: true}}
    );

    return columns;
  }

  if (withChart) {
    columns.push({
      key: 'graph',
      width: 191,
      visible: {[COLUMN_BREAKPOINTS.TREND]: true},
    });
  }

  if (withColumns.includes('event')) {
    columns.push({
      key: 'event',
      width: COL_WIDTH_MINIMUM,
      visible: {[COLUMN_BREAKPOINTS.EVENTS]: true},
    });
  }

  if (withColumns.includes('users')) {
    columns.push({
      key: 'users',
      width: COL_WIDTH_MINIMUM,
      visible: {[COLUMN_BREAKPOINTS.USERS]: true},
    });
  }

  if (withColumns.includes('priority')) {
    columns.push({
      key: 'priority',
      width: COL_WIDTH_MINIMUM,
      visible: {[COLUMN_BREAKPOINTS.PRIORITY]: true},
    });
  }

  if (withColumns.includes('assignee') || withColumns.includes('assigneeAvatar')) {
    columns.push({
      key: 'assignee',
      width: 100,
      visible: {[COLUMN_BREAKPOINTS.ASSIGNEE]: true},
    });
  }

  return columns;
}

/**
 * The issue stream's columns, shared by its header and its rows so that every
 * row renders a cell for each of the table's columns, in the same order.
 */
export function useStreamGroupColumns({canSelect, ...options}: StreamGroupColumnOptions) {
  const issueSelectionSummary = useOptionalIssueSelectionSummary();
  const issueSelectionActions = useOptionalIssueSelectionActions();
  const selectionEnabled =
    canSelect && !!issueSelectionSummary && !!issueSelectionActions;

  return {
    columns: getStreamGroupColumns({...options, canSelect: selectionEnabled}),
    selectionEnabled,
  };
}

const HEADER_LABELS: Record<StreamGroupColumnKey, ReactNode> = {
  select: null,
  issue: t('Issue'),
  lastSeen: t('Last Seen'),
  firstSeen: t('Age'),
  graph: t('Graph'),
  reprocessingStarted: t('Started'),
  reprocessingEvents: t('Events Reprocessed'),
  reprocessingProgress: t('Progress'),
  event: t('Events'),
  users: t('Users'),
  priority: t('Priority'),
  assignee: t('Assignee'),
};

const RIGHT_ALIGNED_COLUMNS = new Set<StreamGroupColumnKey>([
  'lastSeen',
  'firstSeen',
  'event',
  'users',
  'priority',
  'assignee',
]);

interface StreamGroupHeaderCellProps extends ComponentProps<
  typeof SimpleTable.HeaderCell
> {
  column: StreamGroupColumn;
}

export function StreamGroupHeaderCell({
  column,
  children = HEADER_LABELS[column.key],
  ...props
}: StreamGroupHeaderCellProps) {
  const HeaderCell = column.followsSelect ? SelectFollowingHeaderCell : StyledHeaderCell;

  return (
    <HeaderCell
      align={RIGHT_ALIGNED_COLUMNS.has(column.key) ? 'right' : undefined}
      divider={column.followsSelect ? false : undefined}
      {...props}
    >
      {children}
    </HeaderCell>
  );
}

const StyledHeaderCell = styled(SimpleTable.HeaderCell)`
  font-size: ${p => p.theme.font.size.sm};
`;

const SelectFollowingHeaderCell = styled(StyledHeaderCell)`
  padding-left: ${p => p.theme.space.md};
`;

const SELECT_CELL_PROPS: FlexProps<'td'> = {
  align: 'start',
  alignSelf: 'stretch',
  overflow: 'visible',
  padding: 'md 0 0 0',
  position: 'relative',
};

interface StreamGroupCellProps extends Omit<FlexProps<'td'>, 'column'> {
  column: StreamGroupColumn;
}

export function StreamGroupCell({column, ...props}: StreamGroupCellProps) {
  return (
    <SimpleTable.RowCell
      {...(column.key === 'select' ? SELECT_CELL_PROPS : {})}
      {...(column.followsSelect ? {paddingLeft: 'md'} : {})}
      {...(RIGHT_ALIGNED_COLUMNS.has(column.key) ? {justify: 'end'} : {})}
      {...props}
    />
  );
}

interface StreamGroupTableProps extends Omit<
  HTMLAttributes<HTMLTableElement>,
  'children'
> {
  children: ReactNode;
  columns: StreamGroupColumn[];
}

export function StreamGroupTable({children, columns, ...props}: StreamGroupTableProps) {
  return (
    <Container containerType="inline-size" marginBottom="xl">
      <StyledStreamGroupTable {...props} customSections columns={columns}>
        {children}
      </StyledStreamGroupTable>
    </Container>
  );
}

const StyledStreamGroupTable = styled(SimpleTable)`
  overflow: visible;
`;
