import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import SimpleTableChart from 'sentry/components/charts/simpleTableChart';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {MetaType} from 'sentry/utils/discover/eventView';
import type {RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {type Widget, WidgetType} from 'sentry/views/dashboards/types';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import type {TabularColumn} from 'sentry/views/dashboards/widgets/common/types';
import {TableWidgetVisualization} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';
import {
  convertTableDataToTabularData,
  decodeColumnAliases,
} from 'sentry/views/dashboards/widgets/tableWidget/utils';
import {decodeColumnOrder} from 'sentry/views/discover/utils';

type Props = {
  loading: boolean;
  location: Location;
  organization: Organization;
  selection: PageFilters;
  theme: Theme;
  widget: Widget;
  errorMessage?: string;
  onWidgetTableResizeColumn?: (columns: TabularColumn[]) => void;
  tableResults?: TableData[];
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
  onWidgetTableResizeColumn,
}: Props) {
  const datasetConfig = getDatasetConfig(WidgetType.ISSUE);

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
  const fieldAliases = query.fieldAliases ?? [];
  const fieldHeaderMap = datasetConfig.getFieldHeaderMap?.();
  const columns = decodeColumnOrder(queryFields.map(field => ({field}))).map(
    (column, index) => ({
      key: column.key,
      width: widget.tableWidths?.[index] ?? column.width,
      type: column.type === 'never' ? null : column.type,
    })
  );
  const aliases = decodeColumnAliases(columns, fieldAliases, fieldHeaderMap);
  const tableData = convertTableDataToTabularData(tableResults?.[0]);
  const eventView = eventViewFromWidget(widget.title, widget.queries[0]!, selection);

  const getCustomFieldRenderer = (field: string, meta: MetaType, org?: Organization) => {
    return datasetConfig.getCustomFieldRenderer?.(field, meta, widget, org) || null;
  };

  return organization.features.includes('dashboards-use-widget-table-visualization') ? (
    <TableContainer>
      <TableWidgetVisualization
        columns={columns}
        tableData={tableData}
        frameless
        scrollable
        fit="max-content"
        aliases={aliases}
        getRenderer={(field, _dataRow, meta) => {
          const customRenderer = datasetConfig.getCustomFieldRenderer?.(
            field,
            meta as MetaType,
            widget,
            organization
          )!;

          return customRenderer;
        }}
        makeBaggage={(field, _dataRow, meta) => {
          const unit = meta.units?.[field] as string | undefined;

          return {
            location,
            organization,
            theme,
            unit,
          } satisfies RenderFunctionBaggage;
        }}
        onResizeColumn={onWidgetTableResizeColumn}
      />
    </TableContainer>
  ) : (
    <StyledSimpleTableChart
      location={location}
      title=""
      eventView={eventView}
      fields={queryFields}
      fieldAliases={fieldAliases}
      loading={loading}
      metadata={tableResults?.[0]?.meta}
      data={tableResults?.[0]?.data}
      getCustomFieldRenderer={getCustomFieldRenderer}
      fieldHeaderMap={fieldHeaderMap}
      stickyHeaders
    />
  );
}

const LoadingPlaceholder = styled(Placeholder)`
  background-color: ${p => p.theme.surface300};
`;

const StyledSimpleTableChart = styled(SimpleTableChart)`
  margin-top: ${space(1.5)};
  border-bottom-left-radius: ${p => p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSize.md};
  box-shadow: none;
  min-height: 0;
`;

const TableContainer = styled('div')`
  margin-top: ${space(1.5)};
  border-bottom-left-radius: ${p => p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
  min-height: 0;
`;
