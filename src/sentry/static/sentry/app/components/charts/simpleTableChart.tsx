import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import PanelTable from 'app/components/panels/panelTable';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {TableData, TableDataRow} from 'app/utils/discover/discoverQuery';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {fieldAlignment} from 'app/utils/discover/fields';
import withOrganization from 'app/utils/withOrganization';
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
      <React.Fragment>
        {title && <h4>{title}</h4>}
        <StyledPanelTable
          isLoading={loading}
          headers={columns.map((column, index) => {
            const align = fieldAlignment(column.name, column.type, meta);
            return (
              <HeadCell key={index} align={align}>
                {column.name}
              </HeadCell>
            );
          })}
        >
          {data.map((row, index) => this.renderRow(index, row, meta, columns))}
        </StyledPanelTable>
      </React.Fragment>
    );
  }
}

const StyledPanelTable = styled(PanelTable)`
  border-radius: 0;
  border-left: 0;
  border-right: 0;
  border-bottom: 0;

  /* align height with charts */
  height: 190px;
  overflow: scroll;
  margin: ${space(1)} 0 0;
`;

type HeadCellProps = {
  align: string | undefined;
};
const HeadCell = styled('div')<HeadCellProps>`
  ${(p: HeadCellProps) => (p.align ? `text-align: ${p.align};` : '')}
`;

export default withOrganization(SimpleTableChart);
