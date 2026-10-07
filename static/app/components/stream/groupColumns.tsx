import type {HTMLAttributes, ReactNode} from 'react';
import styled from '@emotion/styled';

import {Container, type FlexProps} from '@sentry/scraps/layout';
import {Table, type TableColumnConfig} from '@sentry/scraps/table';

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
    columns.push({key: 'select', width: '32px'});
  }

  columns.push({key: 'issue', width: 'minmax(0, 1fr)'});

  if (withColumns.includes('lastSeen')) {
    columns.push({
      key: 'lastSeen',
      width: '102px',
      visible: {[COLUMN_BREAKPOINTS.LAST_SEEN]: true},
    });
  }

  if (withColumns.includes('firstSeen')) {
    columns.push({
      key: 'firstSeen',
      width: '66px',
      visible: {[COLUMN_BREAKPOINTS.FIRST_SEEN]: true},
    });
  }

  if (displayReprocessingLayout) {
    columns.push(
      {key: 'reprocessingStarted', width: {zero: '117px', xl: '172px'}},
      {key: 'reprocessingEvents', width: {zero: '107px', xl: '172px'}},
      {key: 'reprocessingProgress', width: '192px', visible: {xl: true}}
    );

    return columns;
  }

  if (withChart) {
    columns.push({
      key: 'graph',
      width: '191px',
      visible: {[COLUMN_BREAKPOINTS.TREND]: true},
    });
  }

  if (withColumns.includes('event')) {
    columns.push({
      key: 'event',
      width: '76px',
      visible: {[COLUMN_BREAKPOINTS.EVENTS]: true},
    });
  }

  if (withColumns.includes('users')) {
    columns.push({
      key: 'users',
      width: '76px',
      visible: {[COLUMN_BREAKPOINTS.USERS]: true},
    });
  }

  if (withColumns.includes('priority')) {
    columns.push({
      key: 'priority',
      width: '80px',
      visible: {[COLUMN_BREAKPOINTS.PRIORITY]: true},
    });
  }

  if (withColumns.includes('assignee') || withColumns.includes('assigneeAvatar')) {
    columns.push({
      key: 'assignee',
      width: '90px',
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

interface StreamGroupHeaderCellProps {
  column: StreamGroupColumn;
  selectionEnabled: boolean;
  children?: ReactNode;
  spanRemaining?: boolean;
}

export function StreamGroupHeaderCell({
  children,
  column,
  selectionEnabled,
  spanRemaining,
}: StreamGroupHeaderCellProps) {
  const content = children ?? HEADER_LABELS[column.key];

  if (column.key === 'select') {
    return <SelectHeaderCell scope="col">{content}</SelectHeaderCell>;
  }

  if (column.key === 'issue' && spanRemaining) {
    return <BulkActionsHeaderCell scope="colgroup">{content}</BulkActionsHeaderCell>;
  }

  if (column.key === 'issue') {
    return (
      <IssueHeaderCell divider={false} selectionEnabled={selectionEnabled}>
        {content}
      </IssueHeaderCell>
    );
  }

  if (RIGHT_ALIGNED_COLUMNS.has(column.key)) {
    return <RightAlignedHeaderCell align="right">{content}</RightAlignedHeaderCell>;
  }

  return <SimpleTable.HeaderCell>{content}</SimpleTable.HeaderCell>;
}

const CELL_PROPS: Record<StreamGroupColumnKey, FlexProps<'td'>> = {
  select: {
    align: 'start',
    alignSelf: 'stretch',
    overflow: 'visible',
    padding: 'md 0 0 0',
    position: 'relative',
  },
  issue: {padding: 'md xl'},
  lastSeen: {justify: 'end', padding: 'md xl'},
  firstSeen: {justify: 'end', padding: 'md xl'},
  graph: {padding: 'md 0 md xl'},
  reprocessingStarted: {padding: 'md xl', whiteSpace: 'nowrap'},
  reprocessingEvents: {padding: 'md xl', whiteSpace: 'nowrap'},
  reprocessingProgress: {padding: 'md xl'},
  event: {justify: 'end', padding: 'md xl'},
  users: {justify: 'end', padding: 'md xl'},
  priority: {justify: 'end', padding: 'md xl'},
  assignee: {justify: 'end', padding: 'md xl'},
};

interface StreamGroupCellProps extends Omit<FlexProps<'td'>, 'column'> {
  column: StreamGroupColumn;
  selectionEnabled: boolean;
}

export function StreamGroupCell({
  column,
  selectionEnabled,
  ...props
}: StreamGroupCellProps) {
  return (
    <SimpleTable.RowCell
      {...CELL_PROPS[column.key]}
      {...(column.key === 'issue' && selectionEnabled ? {paddingLeft: 'md'} : {})}
      {...props}
    />
  );
}

// Interactive header content skips `SimpleTable.HeaderCell`, whose label
// wrapper clips focus rings and echoes overflowing content into a tooltip.
const SelectHeaderCell = styled(Table.HeadCell)`
  align-items: center;
  padding-left: ${p => p.theme.space.xl};
`;

const BulkActionsHeaderCell = styled(Table.HeadCell)`
  grid-column: 2 / -1;
  align-items: center;
  padding: 0 ${p => p.theme.space.xl} 0 ${p => p.theme.space.md};
`;

const RightAlignedHeaderCell = styled(SimpleTable.HeaderCell)`
  padding-left: ${p => p.theme.space.md};
`;

const IssueHeaderCell = styled(SimpleTable.HeaderCell, {
  shouldForwardProp: prop => prop !== 'selectionEnabled',
})<{selectionEnabled: boolean}>`
  padding-left: ${p => (p.selectionEnabled ? p.theme.space.md : p.theme.space.xl)};
`;

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
      <StyledStreamGroupTable
        {...props}
        customSections
        columns={columns}
        flexibleLastColumn={false}
      >
        {children}
      </StyledStreamGroupTable>
    </Container>
  );
}

const StyledStreamGroupTable = styled(SimpleTable)`
  overflow: visible;
`;
