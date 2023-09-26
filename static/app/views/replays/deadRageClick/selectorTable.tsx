import {ReactNode, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import renderSortableHeaderCell from 'sentry/components/feedback/table/renderSortableHeaderCell';
import useQueryBasedColumnResize from 'sentry/components/feedback/table/useQueryBasedColumnResize';
import useQueryBasedSorting from 'sentry/components/feedback/table/useQueryBasedSorting';
import GridEditable, {GridColumnOrder} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import TextOverflow from 'sentry/components/textOverflow';
import {Organization} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {DeadRageSelectorItem} from 'sentry/views/replays/types';

export interface UrlState {
  widths: string[];
}

export function getAriaLabel(str: string) {
  const pre = str.split('aria="')[1];
  if (!pre) {
    return '';
  }
  return pre.substring(0, pre.lastIndexOf('"]'));
}

export function hydratedSelectorData(data, clickType): DeadRageSelectorItem[] {
  return data
    .filter(d => d[clickType] > 0)
    .map(d => {
      return {
        [clickType]: d[clickType],
        dom_element: d.dom_element,
        element: d.dom_element.split(/[#.]+/)[0],
        aria_label: getAriaLabel(d.dom_element),
      };
    });
}

interface Props {
  clickCountColumn: {key: string; name: string};
  data: DeadRageSelectorItem[];
  isError: boolean;
  isLoading: boolean;
  location: Location<any>;
  customHandleResize?: () => void;
  headerButtons?: ReactNode;
  title?: ReactNode;
}

const BASE_COLUMNS: GridColumnOrder<string>[] = [
  {key: 'element', name: 'element'},
  {key: 'dom_element', name: 'selector'},
  {key: 'aria_label', name: 'aria label'},
];

export default function SelectorTable({
  clickCountColumn,
  data,
  isError,
  isLoading,
  location,
  title,
  headerButtons,
  customHandleResize,
}: Props) {
  const organization = useOrganization();

  const {currentSort, makeSortLinkGenerator} = useQueryBasedSorting({
    defaultSort: {field: clickCountColumn.key, kind: 'desc'},
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
        sortableColumns: [],
      }),
    [currentSort, makeSortLinkGenerator]
  );

  const renderBodyCell = useCallback(
    (column, dataRow) => {
      const value = dataRow[column.key];
      switch (column.key) {
        case 'dom_element':
          return <SelectorLink organization={organization} value={value} />;
        case 'element':
        case 'aria_label':
          return (
            <code>
              <TextOverflow>{value}</TextOverflow>
            </code>
          );
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
        onResizeColumn: customHandleResize ?? handleResizeColumn,
        renderHeadCell,
        renderBodyCell,
      }}
      location={location as Location<any>}
      title={title}
      headerButtons={() => headerButtons}
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
      <TextOverflow>{value}</TextOverflow>
    </Link>
  );
}

function renderSimpleBodyCell<T>(column: GridColumnOrder<string>, dataRow: T) {
  if (column.key === 'count_dead_clicks') {
    return <DeadClickCount>{dataRow[column.key]}</DeadClickCount>;
  }
  if (column.key === 'count_rage_clicks') {
    return <RageClickCount>{dataRow[column.key]}</RageClickCount>;
  }
  return <TextOverflow>{dataRow[column.key]}</TextOverflow>;
}

const DeadClickCount = styled(TextOverflow)`
  color: ${p => p.theme.yellow300};
`;

const RageClickCount = styled(TextOverflow)`
  color: ${p => p.theme.red300};
`;
