import styled from '@emotion/styled';
import type {Location} from 'history';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {Widget} from 'sentry/views/dashboards/types';
import TableWidgetVisualization, {
  DASHBOARD_TABLE_WIDGET_STYLES,
} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';

type Props = {
  loading: boolean;
  location: Location;
  organization: Organization;
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
  organization,
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
  return (
    <TableContainer>
      <TableWidgetVisualization
        loading={loading}
        organization={organization}
        tableResults={tableResults}
        widget={widget}
        selection={selection}
        stickyHeader
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
