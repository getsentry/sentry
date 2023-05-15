import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import PanelTable, {
  PanelTableHeader,
  PanelTableProps,
} from 'sentry/components/panels/panelTable';
import {Tooltip} from 'sentry/components/tooltip';
import Truncate from 'sentry/components/truncate';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView, {MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import useProjects from 'sentry/utils/useProjects';
import withOrganization from 'sentry/utils/withOrganization';
import {StyledLink} from 'sentry/views/discover/table/tableView';
import TopResultsIndicator from 'sentry/views/discover/table/topResultsIndicator';
import {
  decodeColumnOrder,
  getTargetForTransactionSummaryLink,
} from 'sentry/views/discover/utils';

type Props = {
  eventView: EventView;
  fieldAliases: string[];
  fields: string[];
  loading: boolean;
  location: Location;
  organization: Organization;
  title: string;
  className?: string;
  data?: TableData['data'];
  fieldHeaderMap?: Record<string, string>;
  getCustomFieldRenderer?: (
    field: string,
    meta: MetaType,
    organization?: Organization
  ) => ReturnType<typeof getFieldRenderer> | null;
  loader?: PanelTableProps['loader'];
  metadata?: TableData['meta'];
  stickyHeaders?: boolean;
  topResultsIndicators?: number;
};

function SimpleTableChart({
  className,
  loading,
  eventView,
  fields,
  metadata,
  data,
  title,
  fieldHeaderMap,
  stickyHeaders,
  getCustomFieldRenderer,
  organization,
  topResultsIndicators,
  location,
  fieldAliases,
  loader,
}: Props) {
  const {projects} = useProjects();
  function renderRow(
    index: number,
    row: TableDataRow,
    tableMeta: NonNullable<TableData['meta']>,
    columns: ReturnType<typeof decodeColumnOrder>
  ) {
    return columns.map((column, columnIndex) => {
      const fieldRenderer =
        getCustomFieldRenderer?.(column.key, tableMeta, organization) ??
        getFieldRenderer(column.key, tableMeta);

      const unit = tableMeta.units?.[column.key];
      let cell = fieldRenderer(row, {organization, location, eventView, unit});

      if (column.key === 'transaction' && row.transaction) {
        cell = (
          <StyledLink
            to={getTargetForTransactionSummaryLink(
              row,
              organization,
              projects,
              eventView
            )}
          >
            {cell}
          </StyledLink>
        );
      }

      return (
        <TableCell key={`${index}-${columnIndex}:${column.name}`}>
          {topResultsIndicators && columnIndex === 0 && (
            <TopResultsIndicator count={topResultsIndicators} index={index} />
          )}
          {cell}
        </TableCell>
      );
    });
  }

  const meta = metadata ?? {};
  const columns = decodeColumnOrder(
    fields.map((field, index) => ({field, alias: fieldAliases[index]}))
  );

  return (
    <Fragment>
      {title && <h4>{title}</h4>}
      <StyledPanelTable
        className={className}
        isLoading={loading}
        loader={loader}
        headers={columns.map((column, index) => {
          const align = fieldAlignment(column.name, column.type, meta);
          const header =
            column.column.alias || (fieldHeaderMap?.[column.key] ?? column.name);
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
        {data?.map((row, index) => renderRow(index, row, meta, columns))}
      </StyledPanelTable>
    </Fragment>
  );
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
  ${PanelTableHeader} {
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

export const TableCell = styled('div')`
  padding: ${space(1)} ${space(3)};
`;

export default withOrganization(SimpleTableChart);
