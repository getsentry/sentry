import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {type Widget} from 'sentry/views/dashboards/types';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import type {TabularValueType} from 'sentry/views/dashboards/widgets/common/types';
import {TableWidgetVisualization} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';
import {convertTableDataToTabularData} from 'sentry/views/dashboards/widgets/tableWidget/utils';
import {renderWidgetBodyCell} from 'sentry/views/dashboards/widgets/tableWidget/widgetTableCellRenderers';
import {decodeColumnOrder} from 'sentry/views/discover/utils';

type Props = {
  loading: boolean;
  location: Location;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  errorMessage?: string;
  tableResults?: TableDataWithTitle[];
  theme?: Theme;
};

export function IssueWidgetCard({
  widget,
  errorMessage,
  loading,
  tableResults,
  selection,
  organization,
  location,
  theme,
}: Props) {
  if (errorMessage) {
    return (
      <ErrorPanel>
        <IconWarning color="gray500" size="lg" />
      </ErrorPanel>
    );
  }

  if (loading || !tableResults) {
    // Align height to other charts.
    return <LoadingPlaceholder height="200px" />;
  }

  const query = widget.queries[0]!;
  const queryFields = defined(query.fields)
    ? query.fields
    : [...query.columns, ...query.aggregates];
  const columns = decodeColumnOrder(
    queryFields.map(field => ({
      field,
    }))
  ).map(column => ({
    key: column.key,
    name: column.name,
    width: column.width,
    type: column.type as TabularValueType,
  }));
  const tableData = convertTableDataToTabularData(tableResults?.[0]);
  const eventView = eventViewFromWidget(widget.title, widget.queries[0]!, selection);

  return (
    <TableContainer>
      <TableWidgetVisualization
        columns={columns}
        tableData={tableData}
        frameless
        scrollable
        fit="max-content"
        renderTableBodyCell={renderWidgetBodyCell({
          location,
          widget,
          tableData,
          eventView,
          organization,
          theme,
        })}
      />
    </TableContainer>
  );
}

const LoadingPlaceholder = styled(Placeholder)`
  background-color: ${p => p.theme.surface300};
`;

const TableContainer = styled('div')`
  margin-top: ${space(1.5)};
  border-bottom-left-radius: ${p => p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
  min-height: 0;
`;
