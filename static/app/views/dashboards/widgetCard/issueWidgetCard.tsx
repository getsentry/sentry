import styled from '@emotion/styled';
import type {Location} from 'history';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import {renderIssueGridHeaderCell} from 'sentry/components/modals/widgetViewerModal/widgetViewerTableCell';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {Widget} from 'sentry/views/dashboards/types';
import {TABLE_WIDGET_STYLES} from 'sentry/views/dashboards/widgetCard';
import WidgetTable from 'sentry/views/dashboards/widgetTable';

type Props = {
  loading: boolean;
  location: Location;
  organization: Organization;
  selection: PageFilters;
  tableResults: TableDataWithTitle[] | undefined;
  widget: Widget;
  errorMessage?: string;
  isPreview?: boolean;
  setTableWidths?: (tableWidths: string[]) => void;
  setWidgetSort?: (ns: string) => void;
  tableWidths?: string[];
};

export function IssueWidgetCard({
  selection,
  widget,
  errorMessage,
  loading,
  tableResults,
  setWidgetSort,
  organization,
  tableWidths,
  setTableWidths,
  isPreview,
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

  const sort = widget.queries[0]?.orderby;

  return (
    <TableWrapper>
      <WidgetTable
        style={TABLE_WIDGET_STYLES}
        loading={loading}
        tableResults={tableResults}
        widget={widget}
        selection={selection}
        renderHeaderGridCell={renderIssueGridHeaderCell}
        sort={sort || ''}
        widths={tableWidths || []}
        organization={organization}
        stickyHeader
        setWidgetSort={setWidgetSort}
        setWidths={(w: string[]) => setTableWidths?.(w)}
        usesLocationQuery={isPreview}
        fitMaxContent={!isPreview}
      />
    </TableWrapper>
  );
}

const LoadingPlaceholder = styled(Placeholder)`
  background-color: ${p => p.theme.surface300};
`;

const TableWrapper = styled('div')`
  margin-top: ${space(1.5)};
  min-height: 0;
  border-bottom-left-radius: ${p => p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
`;
