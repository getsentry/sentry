import type {Dispatch, SetStateAction} from 'react';
import {useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import {renderIssueGridHeaderCell} from 'sentry/components/modals/widgetViewerModal/widgetViewerTableCell';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {Widget} from 'sentry/views/dashboards/types';
import {WidgetTable} from 'sentry/views/dashboards/widgetTable';

type Props = {
  loading: boolean;
  location: Location;
  organization: Organization;
  selection: PageFilters;
  tableResults: TableDataWithTitle[] | undefined;
  widget: Widget;
  errorMessage?: string;
  setCurrentWidget?: Dispatch<SetStateAction<Widget>>;
};

export function IssueWidgetCard({
  selection,
  widget,
  errorMessage,
  loading,
  tableResults,
  setCurrentWidget,
  organization,
}: Props) {
  const [widths, setWidths] = useState<string[]>([]);

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
    <div style={{overflow: 'auto'}}>
      <StyledWidgetTable
        style={{
          borderRadius: 0,
          marginBottom: 0,
          borderLeft: 0,
          borderRight: 0,
          borderBottom: 0,
        }}
        loading={loading}
        tableResults={tableResults}
        widget={widget}
        selection={selection}
        renderHeaderGridCell={renderIssueGridHeaderCell}
        sort={sort || ''}
        widths={widths}
        organization={organization}
        stickyHeader
        setCurrentWidget={setCurrentWidget}
        setWidths={(w: string[]) => setWidths(w)}
        usesLocationQuery={false}
      />
    </div>
  );
}

const LoadingPlaceholder = styled(Placeholder)`
  background-color: ${p => p.theme.surface300};
`;

const StyledWidgetTable = styled(WidgetTable)`
  border-bottom-left-radius: ${p => p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSizeMedium};
  box-shadow: none;
  overflow: auto;
`;
