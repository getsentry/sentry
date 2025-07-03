import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {ReplayTableColumn} from 'sentry/components/replays/table/replayTableColumns';
import ReplayTableHeader from 'sentry/components/replays/table/replayTableHeader';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import type RequestError from 'sentry/utils/requestError/requestError';
import {ERROR_MAP} from 'sentry/utils/requestError/requestError';
import type {ReplayListRecord} from 'sentry/views/replays/types';

type SortProps =
  | {
      onSortClick: (key: string) => void;
      sort: Sort;
    }
  | {onSortClick?: never; sort?: never};

type Props = SortProps & {
  columns: readonly ReplayTableColumn[];
  error: RequestError | null | undefined;
  isPending: boolean;
  replays: ReplayListRecord[];
  showDropdownFilters: boolean;
  onClickRow?: (props: {replay: ReplayListRecord; rowIndex: number}) => void;
};

export default function ReplayTable({
  columns,
  error,
  isPending,
  onClickRow,
  onSortClick,
  replays,
  showDropdownFilters,
  sort,
}: Props) {
  if (isPending) {
    return (
      <ReplayTableWithColumns columns={columns} data-test-id="replay-table-loading">
        <ReplayTableHeader columns={columns} onSortClick={onSortClick} sort={sort} />
        <SimpleTable.Empty>
          <LoadingIndicator />
        </SimpleTable.Empty>
      </ReplayTableWithColumns>
    );
  }

  if (error) {
    return (
      <ReplayTableWithColumns columns={columns} data-test-id="replay-table-errored">
        <ReplayTableHeader columns={columns} onSortClick={onSortClick} sort={sort} />
        <SimpleTable.Empty>
          <Alert type="error" showIcon>
            {t('Sorry, the list of replays could not be loaded. ')}
            {getErrorMessage(error)}
          </Alert>
        </SimpleTable.Empty>
      </ReplayTableWithColumns>
    );
  }

  return (
    <ReplayTableWithColumns columns={columns} data-test-id="replay-table">
      <ReplayTableHeader columns={columns} onSortClick={onSortClick} sort={sort} />
      {replays.length === 0 && (
        <SimpleTable.Empty>{t('No replays found')}</SimpleTable.Empty>
      )}
      {replays.map((replay, rowIndex) => {
        const rows = columns.map((column, columnIndex) => (
          <RowCell key={`${replay.id}-${column.sortKey}`}>
            <column.Component
              columnIndex={columnIndex}
              replay={replay}
              rowIndex={rowIndex}
              showDropdownFilters={showDropdownFilters}
            />
          </RowCell>
        ));
        return (
          <SimpleTable.Row
            key={replay.id}
            variant={replay.is_archived ? 'faded' : 'default'}
          >
            {onClickRow ? (
              <RowContentButton as="div" onClick={() => onClickRow({replay, rowIndex})}>
                <InteractionStateLayer />
                {rows}
              </RowContentButton>
            ) : (
              rows
            )}
          </SimpleTable.Row>
        );
      })}
    </ReplayTableWithColumns>
  );
}

const ReplayTableWithColumns = styled(SimpleTable, {
  shouldForwardProp: prop => prop !== 'columns',
})<{
  columns: readonly ReplayTableColumn[];
}>`
  grid-template-columns: ${p =>
    p.columns.map(col => col.width ?? 'max-content').join(' ')};
  margin-bottom: 0;
  overflow: auto;

  [data-clickable='true'] {
    cursor: pointer;
  }
`;

function getErrorMessage(fetchError: RequestError) {
  if (typeof fetchError === 'string') {
    return fetchError;
  }
  if (typeof fetchError?.responseJSON?.detail === 'string') {
    return fetchError.responseJSON.detail;
  }
  if (fetchError?.responseJSON?.detail?.message) {
    return fetchError.responseJSON.detail.message;
  }
  if (fetchError.name === ERROR_MAP[500]) {
    return t('There was an internal systems error.');
  }
  return t(
    'This could be due to invalid search parameters or an internal systems error.'
  );
}

const RowContentButton = styled('button')`
  display: contents;
  cursor: pointer;

  border: none;
  background: transparent;
  margin: 0;
  padding: 0;
`;

const RowCell = styled(SimpleTable.RowCell)`
  position: relative;
  overflow: auto;

  &:hover [data-underline-on-hover='true'] {
    text-decoration: underline;
  }
`;
