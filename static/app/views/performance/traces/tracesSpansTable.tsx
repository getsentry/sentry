import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import {Container} from 'sentry/utils/discover/styles';
import {useLocation} from 'sentry/utils/useLocation';

interface TracesSpansTableProps {
  data: any[];
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

  const columnOrder = useMemo(() => {
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
  return function (col, row) {
    return <Container>{row[col.key]}</Container>;
  };
}

const StyledGridEditable = styled(GridEditable)`
  margin: 0px;
`;

const StyledPagination = styled(Pagination)`
  margin: 0px;
`;
