import styled from '@emotion/styled';
import type {Location} from 'history';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {Widget} from 'sentry/views/dashboards/types';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import TableWidgetVisualization, {
  DASHBOARD_TABLE_WIDGET_STYLES,
} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';

type Props = {
  loading: boolean;
  location: Location;
  selection: PageFilters;
  tableResults: TableDataWithTitle[] | undefined;
  widget: Widget;
  errorMessage?: string;
};

export function IssueWidgetCard({
  selection,
  widget,
  errorMessage,
  loading,
  tableResults,
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

  const eventView = eventViewFromWidget(widget.title, widget.queries[0]!, selection);

  return (
    <TableContainer>
      <TableWidgetVisualization
        loading={loading}
        tableResults={tableResults}
        widget={widget}
        eventView={eventView}
        stickyHeader
        scrollable
        style={DASHBOARD_TABLE_WIDGET_STYLES}
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
