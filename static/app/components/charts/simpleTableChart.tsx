import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import PanelTable, {PanelTableHeader} from 'sentry/components/panels/panelTable';
import Tooltip from 'sentry/components/tooltip';
import Truncate from 'sentry/components/truncate';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import withOrganization from 'sentry/utils/withOrganization';
import TopResultsIndicator from 'sentry/views/eventsV2/table/topResultsIndicator';
import {decodeColumnOrder} from 'sentry/views/eventsV2/utils';

type Props = {
  data: TableData['data'] | undefined;
  fields: string[];
  loading: boolean;
  location: Location;
  metadata: TableData['meta'] | undefined;
  organization: Organization;
  title: string;
  className?: string;
  fieldHeaderMap?: Record<string, string>;
  getCustomFieldRenderer?: (
    field: string,
    meta: MetaType
  ) => ReturnType<typeof getFieldRenderer> | null;
  stickyHeaders?: boolean;
  topResultsIndicators?: number;
};

class SimpleTableChart extends Component<Props> {
  renderRow(
    index: number,
    row: TableDataRow,
    tableMeta: NonNullable<TableData['meta']>,
    columns: ReturnType<typeof decodeColumnOrder>
  ) {
    const {location, organization, getCustomFieldRenderer, topResultsIndicators} =
      this.props;

    return columns.map((column, columnIndex) => {
      const fieldRenderer =
        getCustomFieldRenderer?.(column.key, tableMeta) ??
        getFieldRenderer(column.key, tableMeta);
      const rendered = fieldRenderer(row, {organization, location});
      return (
        <TableCell key={`${index}-${columnIndex}:${column.name}`}>
          {topResultsIndicators && columnIndex === 0 && (
            <TopResultsIndicator count={topResultsIndicators} index={index} />
          )}
          {rendered}
        </TableCell>
      );
    });
  }

  render() {
    const {
      className,
      loading,
      fields,
      metadata,
      data,
      title,
      fieldHeaderMap,
      stickyHeaders,
    } = this.props;
    const meta = metadata ?? {};
    const columns = decodeColumnOrder(fields.map(field => ({field})));
    return (
      <Fragment>
        {title && <h4>{title}</h4>}
        <StyledPanelTable
          className={className}
          isLoading={loading}
          headers={columns.map((column, index) => {
            const align = fieldAlignment(column.name, column.type, meta);
            const header = fieldHeaderMap?.[column.key] ?? column.name;
            return (
              <HeadCell key={index} align={align}>
                <Tooltip title={header}>
                  <StyledTruncate value={header} maxLength={30} expandable={false} />
                </Tooltip>
              </HeadCell>
            );
          })}
          isEmpty={!data?.length}
          stickyHeaders={stickyHeaders}
          disablePadding
        >
          {data?.map((row, index) => this.renderRow(index, row, meta, columns))}
        </StyledPanelTable>
      </Fragment>
    );
  }
}

const StyledTruncate = styled(Truncate)`
  white-space: nowrap;
`;

const StyledPanelTable = styled(PanelTable)`
  border-radius: 0;
  border-left: 0;
  border-right: 0;
  border-bottom: 0;

  margin: 0;
  ${/* sc-selector */ PanelTableHeader} {
    height: min-content;
  }
`;

type HeadCellProps = {
  align: string | undefined;
};
const HeadCell = styled('div')<HeadCellProps>`
  ${(p: HeadCellProps) => (p.align ? `text-align: ${p.align};` : '')}
  padding: ${space(1)} ${space(3)};
`;

const TableCell = styled('div')`
  padding: ${space(1)} ${space(3)};
`;

export default withOrganization(SimpleTableChart);
