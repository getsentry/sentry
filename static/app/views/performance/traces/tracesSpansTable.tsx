import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import {useLocation} from 'sentry/utils/useLocation';

import {getFieldRenderer} from './table/fieldRenderers';
import type {ColumnKey, DataRow} from './table/types';

interface TracesSpansTableProps {
  data: DataRow[];
  fields: string[];
  handleCursor: CursorHandler;
  isLoading: boolean;
  pageLinks?: string;
}

export function TracesSpansTable({
  data,
  fields,
  isLoading,
  pageLinks,
  handleCursor,
}: TracesSpansTableProps) {
  const location = useLocation();

  const columnOrder: GridColumnOrder<ColumnKey>[] = useMemo(() => {
    return fields.map(field => {
      return {
        key: field,
        width: COL_WIDTH_UNDEFINED,
        name: field, // TODO: add more user friendly names for them
      };
    });
  }, [fields]);

  return (
    <Fragment>
      <StyledGridEditable
        isLoading={isLoading}
        columnOrder={columnOrder}
        columnSortBy={[]}
        data={data}
        grid={{
          renderBodyCell: renderBodyCell(),
        }}
        location={location}
      />
      <StyledPagination pageLinks={pageLinks} onCursor={handleCursor} />
    </Fragment>
  );
}

function renderBodyCell() {
  return function (column: GridColumnOrder<ColumnKey>, row: DataRow) {
    const Renderer = getFieldRenderer(column.key);
    return <Renderer column={column} row={row} />;
  };
}

const StyledGridEditable = styled(GridEditable)`
  margin: 0px;
`;

const StyledPagination = styled(Pagination)`
  margin: 0px;
`;
