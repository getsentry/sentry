import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import PanelTable from 'app/components/panels/panelTable';
import {Organization} from 'app/types';
import {TableData, TableDataRow} from 'app/utils/discover/discoverQuery';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import withOrganization from 'app/utils/withOrganization';
import HeaderCell from 'app/views/eventsV2/table/headerCell';
import {decodeColumnOrder} from 'app/views/eventsV2/utils';

type Props = {
  organization: Organization;
  location: Location;
  loading: boolean;
  fields: string[];
  title: string;
  metadata: TableData['meta'];
  data: TableData['data'];
};

class SimpleTableChart extends React.Component<Props> {
  renderRow(
    index: number,
    row: TableDataRow,
    tableMeta: NonNullable<TableData['meta']>,
    columns: ReturnType<typeof decodeColumnOrder>
  ) {
    const {location, organization} = this.props;

    return columns.map(column => {
      const fieldRenderer = getFieldRenderer(column.name, tableMeta);
      const rendered = fieldRenderer(row, {organization, location});
      return <div key={`${index}:${column.name}`}>{rendered}</div>;
    });
  }

  render() {
    const {loading, fields, metadata, data, title} = this.props;
    const meta = metadata ?? {};
    const columns = decodeColumnOrder(fields.map(field => ({field})));
    return (
      <TableWrapper>
        {title && <h4>{title}</h4>}
        <PanelTable
          isLoading={loading}
          headers={columns.map((column, index) => {
            return (
              <HeaderCell column={column} tableMeta={meta} key={index}>
                {({align}) => <HeadCell align={align}>{column.name}</HeadCell>}
              </HeaderCell>
            );
          })}
        >
          {data.map((row, index) => this.renderRow(index, row, meta, columns))}
        </PanelTable>
      </TableWrapper>
    );
  }
}
const TableWrapper = styled('div')`
  /* align height with charts */
  height: 160px;
  overflow-y: scroll;

  /* Space away from where the widget title is */
  margin-top: 40px;
`;

type HeadCellProps = {
  align: string | undefined;
};
const HeadCell = styled('div')<HeadCellProps>`
  ${(p: HeadCellProps) => (p.align ? `text-align: ${p.align};` : '')}
`;

export default withOrganization(SimpleTableChart);
