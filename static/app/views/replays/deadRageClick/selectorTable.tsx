import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import renderSortableHeaderCell from 'sentry/components/feedback/table/renderSortableHeaderCell';
import useQueryBasedColumnResize from 'sentry/components/feedback/table/useQueryBasedColumnResize';
import useQueryBasedSorting from 'sentry/components/feedback/table/useQueryBasedSorting';
import GridEditable, {GridColumnOrder} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {Organization} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {
  DeadRageSelectorItem,
  DeadRageSelectorQueryParams,
} from 'sentry/views/replays/types';

interface UrlState {
  widths: string[];
}

interface Props {
  clickCountColumn: {key: string; name: string};
  clickType: 'count_dead_clicks' | 'count_rage_clicks';
  data: DeadRageSelectorItem[];
  isError: boolean;
  isLoading: boolean;
  location: Location<DeadRageSelectorQueryParams & UrlState>;
}

const BASE_COLUMNS: GridColumnOrder<string>[] = [
  {key: 'element', name: 'element'},
  {key: 'dom_element', name: 'selector'},
  {key: 'aria_label', name: 'aria label'},
];

export default function SelectorTable({
  clickType,
  clickCountColumn,
  isError,
  isLoading,
  data,
  location,
}: Props) {
  const organization = useOrganization();

  const {currentSort, makeSortLinkGenerator} = useQueryBasedSorting({
    defaultSort: {field: clickType, kind: 'desc'},
    location,
  });

  const {columns, handleResizeColumn} = useQueryBasedColumnResize({
    columns: BASE_COLUMNS.concat(clickCountColumn),
    location,
  });

  const renderHeadCell = useMemo(
    () =>
      renderSortableHeaderCell({
        currentSort,
        makeSortLinkGenerator,
        onClick: () => {},
        rightAlignedColumns: [],
        sortableColumns: [clickCountColumn],
      }),
    [clickCountColumn, currentSort, makeSortLinkGenerator]
  );

  const renderBodyCell = useCallback(
    (column, dataRow) => {
      const value = dataRow[column.key];
      switch (column.key) {
        case 'dom_element':
          return <SelectorLink organization={organization} value={value} />;
        case 'element':
          return <code>{value}</code>;
        case 'aria_label':
          return <code>{value}</code>;
        default:
          return renderSimpleBodyCell<DeadRageSelectorItem>(column, dataRow);
      }
    },
    [organization]
  );

  return (
    <GridEditable
      error={isError}
      isLoading={isLoading}
      data={data ?? []}
      columnOrder={columns}
      columnSortBy={[]}
      stickyHeader
      grid={{
        onResizeColumn: handleResizeColumn,
        renderHeadCell,
        renderBodyCell,
      }}
      location={location as Location<any>}
    />
  );
}

function SelectorLink({
  organization,
  value,
}: {
  organization: Organization;
  value: string;
}) {
  return (
    <Link
      to={{
        pathname: normalizeUrl(`/organizations/${organization.slug}/replays/`),
      }}
    >
      {value}
    </Link>
  );
}

function renderSimpleBodyCell<T>(column: GridColumnOrder<string>, dataRow: T) {
  return dataRow[column.key];
}
