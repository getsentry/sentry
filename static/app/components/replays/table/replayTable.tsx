import {useEffect, useRef, type RefObject} from 'react';
import styled from '@emotion/styled';
import type {Query} from 'history';

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
import useOrganization from 'sentry/utils/useOrganization';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';
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
  highlightedRowIndex?: number;
  query?: Query;
  ref?: RefObject<HTMLDivElement | null>;
  stickyHeader?: boolean;
};

export default function ReplayTable({
  query,
  columns,
  error,
  isPending,
  onSortClick,
  ref,
  replays,
  showDropdownFilters,
  highlightedRowIndex = -1,
  sort,
  // stickyHeader only works if the table is inside a scrollable container
  stickyHeader = false,
}: Props) {
  const gridTemplateColumns = columns.map(col => col.width ?? 'max-content').join(' ');
  const hasInteractiveColumn = columns.some(col => col.interactive);
  const organization = useOrganization();

  if (isPending) {
    return (
      <StyledSimpleTable
        data-test-id="replay-table-loading"
        ref={ref}
        style={{gridTemplateColumns}}
      >
        <ReplayTableHeader
          columns={columns}
          replays={replays}
          onSortClick={onSortClick}
          sort={sort}
          stickyHeader={stickyHeader}
        />
        <SimpleTable.Empty>
          <LoadingIndicator />
        </SimpleTable.Empty>
      </StyledSimpleTable>
    );
  }

  if (error) {
    return (
      <StyledSimpleTable
        data-test-id="replay-table-errored"
        ref={ref}
        style={{gridTemplateColumns}}
      >
        <ReplayTableHeader
          columns={columns}
          onSortClick={onSortClick}
          replays={replays}
          sort={sort}
          stickyHeader={stickyHeader}
        />

        <SimpleTable.Empty>
          <Alert variant="danger">
            {t('Sorry, the list of replays could not be loaded. ')}
            {getErrorMessage(error)}
          </Alert>
        </SimpleTable.Empty>
      </StyledSimpleTable>
    );
  }

  return (
    <StyledSimpleTable
      data-test-id="replay-table"
      ref={ref}
      style={{gridTemplateColumns}}
    >
      <ReplayTableHeader
        columns={columns}
        onSortClick={onSortClick}
        replays={replays}
        sort={sort}
        stickyHeader={stickyHeader}
      />
      {replays.length === 0 && (
        <SimpleTable.Empty>{t('No replays found')}</SimpleTable.Empty>
      )}
      {replays.map((replay, rowIndex) => (
        <RowWithScrollIntoView
          scrollIntoView={highlightedRowIndex === rowIndex}
          key={replay.id}
          variant={replay.is_archived ? 'faded' : 'default'}
        >
          {hasInteractiveColumn ? (
            <InteractionStateLayer
              isHovered={highlightedRowIndex === rowIndex ? true : undefined}
            />
          ) : null}
          {columns.map((column, columnIndex) => (
            <RowCell key={`${replay.id}-${columnIndex}-${column.sortKey}`}>
              <column.Component
                to={{
                  pathname: makeReplaysPathname({path: `/${replay.id}/`, organization}),
                  query,
                }}
                columnIndex={columnIndex}
                replay={replay}
                rowIndex={rowIndex}
                showDropdownFilters={showDropdownFilters}
              />
            </RowCell>
          ))}
        </RowWithScrollIntoView>
      ))}
    </StyledSimpleTable>
  );
}

function RowWithScrollIntoView({
  children,
  scrollIntoView,
  ...props
}: {
  children: React.ReactNode;
  scrollIntoView: boolean;
} & React.ComponentProps<typeof SimpleTable.Row>) {
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollIntoView) {
      rowRef.current?.scrollIntoView();
    }
  }, [scrollIntoView]);
  return (
    <SimpleTable.Row {...props} ref={rowRef}>
      {children}
    </SimpleTable.Row>
  );
}

const StyledSimpleTable = styled(SimpleTable)`
  overflow: auto;
  grid-auto-rows: min-content;

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

const RowCell = styled(SimpleTable.RowCell)`
  /* Used for cell menu items that are hidden by default */
  &:hover [data-visible-on-hover='true'] {
    opacity: 1;
  }

  /* Used for the main replay display name in ReplaySessionColumn  */
  &:hover [data-underline-on-hover='true'] {
    text-decoration: underline;
  }
`;
