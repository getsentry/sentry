import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import {Alignments} from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import {Organization} from 'sentry/types';
import {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {TableColumn} from 'sentry/views/discover/table/types';
import {EndpointDataRow} from 'sentry/views/starfish/views/endpointDetails';

type Props = {
  eventView: EventView;
  isLoading: boolean;
  location: Location;
  organization: Organization;
  tableData: TableData | null;
  pageLinks?: string | null | undefined;
};

const COLUMN_ORDER = [
  {
    key: 'transaction',
    name: 'endpoint',
    width: 350,
  },
  {
    key: 'count_if(http.status_code,greaterOrEquals,500)',
    name: 'Errors',
    width: 50,
  },
  {
    key: 'equation|count_if(http.status_code,greaterOrEquals,500)/(count_if(http.status_code,equals,200)+count_if(http.status_code,greaterOrEquals,500))',
    name: 'Error Rate',
    width: 50,
  },
];

export default function FailureDetailTable({
  location,
  organization,
  eventView,
  isLoading,
  tableData,
  pageLinks,
}: Props) {
  function renderHeadCell(column: GridColumnHeader): React.ReactNode {
    return <StyledNonLink align="left">{column.name}</StyledNonLink>;
  }

  function renderBodyCell(
    column: TableColumn<keyof TableDataRow>,
    dataRow: TableDataRow,
    _onSelect?: (row: EndpointDataRow) => void
  ): React.ReactNode {
    if (!tableData || !tableData.meta) {
      return dataRow[column.key];
    }
    const field = String(column.key);
    const fieldRenderer = getFieldRenderer(field, tableData.meta, false);
    const rendered = fieldRenderer(dataRow, {organization, location});

    if (column.key === 'transaction') {
      const prefix = dataRow['http.method'] ? `${dataRow['http.method']} ` : '';
      return (
        <Link
          to={{
            pathname: `/starfish/failure-detail/${
              dataRow['http.method']
            }:${encodeURIComponent(dataRow.transaction)}`,
            query: {start: location.query.start, end: location.query.end},
          }}
        >
          {prefix}
          {dataRow.transaction}
        </Link>
      );
    }

    return rendered;
  }

  return (
    <Fragment>
      <GridEditable
        isLoading={isLoading}
        data={tableData ? tableData.data : []}
        columnOrder={COLUMN_ORDER}
        columnSortBy={eventView.getSorts()}
        grid={{
          renderHeadCell,
          renderBodyCell: (column: GridColumnHeader, dataRow: TableDataRow) =>
            renderBodyCell(column as TableColumn<keyof TableDataRow>, dataRow) as any,
        }}
        location={location}
      />

      <Pagination pageLinks={pageLinks} />
    </Fragment>
  );
}

const StyledNonLink = styled('div')<{align: Alignments}>`
  display: block;
  width: 100%;
  white-space: nowrap;
  ${(p: {align: Alignments}) => (p.align ? `text-align: ${p.align};` : '')}
`;
