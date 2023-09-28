import {ReactNode, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import GridEditable, {GridColumnOrder} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import renderSortableHeaderCell from 'sentry/components/replays/renderSortableHeaderCell';
import useQueryBasedColumnResize from 'sentry/components/replays/useQueryBasedColumnResize';
import useQueryBasedSorting from 'sentry/components/replays/useQueryBasedSorting';
import TextOverflow from 'sentry/components/textOverflow';
import {IconCursorArrow} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {ColorOrAlias} from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {transformSelectorQuery} from 'sentry/views/replays/deadRageClick/deadRageSelectorCards';
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

export function hydratedSelectorData(data, clickType?): DeadRageSelectorItem[] {
  return data.map(d => ({
    ...(clickType
      ? {[clickType]: d[clickType]}
      : {
          count_dead_clicks: d.count_dead_clicks,
          count_rage_clicks: d.count_rage_clicks,
        }),
    dom_element: d.dom_element,
    element: d.dom_element.split(/[#.]+/)[0],
    aria_label: getAriaLabel(d.dom_element),
  }));
}

interface Props {
  clickCountColumns: {key: string; name: string}[];
  clickCountSortable: boolean;
  data: DeadRageSelectorItem[];
  isError: boolean;
  isLoading: boolean;
  location: Location<any>;
  title?: ReactNode;
}

const BASE_COLUMNS: GridColumnOrder<string>[] = [
  {key: 'element', name: 'element'},
  {key: 'dom_element', name: 'selector'},
  {key: 'aria_label', name: 'aria label'},
];

export default function SelectorTable({
  clickCountColumns,
  data,
  isError,
  isLoading,
  location,
  title,
  clickCountSortable,
}: Props) {
  const {currentSort, makeSortLinkGenerator} = useQueryBasedSorting({
    defaultSort: {field: clickCountColumns[0].key, kind: 'desc'},
    location,
  });

  const {columns, handleResizeColumn} = useQueryBasedColumnResize({
    columns: BASE_COLUMNS.concat(clickCountColumns),
    location,
  });

  const renderHeadCell = useMemo(
    () =>
      renderSortableHeaderCell({
        currentSort,
        makeSortLinkGenerator,
        onClick: () => {},
        rightAlignedColumns: [],
        sortableColumns: clickCountSortable ? clickCountColumns : [],
      }),
    [currentSort, makeSortLinkGenerator, clickCountColumns, clickCountSortable]
  );

  const queryPrefix = currentSort.field.includes('count_dead_clicks') ? 'dead' : 'rage';

  const renderBodyCell = useCallback(
    (column, dataRow) => {
      const value = dataRow[column.key];
      switch (column.key) {
        case 'dom_element':
          return (
            <SelectorLink
              value={value}
              selectorQuery={`${queryPrefix}.selector:"${transformSelectorQuery(value)}"`}
            />
          );
        case 'element':
        case 'aria_label':
          return (
            <TextOverflow>
              <code>{value}</code>
            </TextOverflow>
          );
        default:
          return renderSimpleBodyCell<DeadRageSelectorItem>(column, dataRow);
      }
    },
    [queryPrefix]
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
      title={title}
    />
  );
}

export function SelectorLink({
  value,
  selectorQuery,
}: {
  selectorQuery: string;
  value: string;
}) {
  const organization = useOrganization();
  const location = useLocation();
  return (
    <Link
      to={{
        pathname: normalizeUrl(`/organizations/${organization.slug}/replays/`),
        query: {
          ...location.query,
          query: selectorQuery,
          cursor: undefined,
        },
      }}
    >
      <StyledTextOverflow>
        <code>{value}</code>
      </StyledTextOverflow>
    </Link>
  );
}

function renderSimpleBodyCell<T>(column: GridColumnOrder<string>, dataRow: T) {
  const color =
    column.key === 'count_rage_clicks'
      ? 'red300'
      : column.key === 'count_dead_clicks'
      ? 'yellow300'
      : 'gray300';

  return (
    <ClickColor color={color}>
      <IconCursorArrow size="xs" />
      {dataRow[column.key]}
    </ClickColor>
  );
}

const ClickColor = styled(TextOverflow)<{color: ColorOrAlias}>`
  color: ${p => p.theme[p.color]};
  display: grid;
  grid-template-columns: auto auto;
  gap: ${space(0.75)};
  align-items: center;
  justify-content: start;
`;

const StyledTextOverflow = styled(TextOverflow)`
  & code {
    color: ${p => p.theme.blue300};
  }
`;
