import {useCallback} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

export enum TableType {
  TRACES = 'traces',
  MODELS = 'models',
  TOOLS = 'tools',
}

function isTableType(value: any): value is TableType {
  return Object.values(TableType).includes(value as TableType);
}

export function useActiveTable() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const activeTable: TableType = isTableType(location.query.view)
    ? location.query.view
    : TableType.TRACES;

  const updateQuery = useCallback(
    (newParams: Record<string, string | string[] | null | undefined>) => {
      const newQuery = {
        ...location.query,
        ...newParams,
      };

      navigate(
        {
          pathname: location.pathname,
          query: newQuery,
        },
        {replace: true, preventScrollReset: true}
      );
    },
    [location.query, location.pathname, navigate]
  );

  const onActiveTableChange = useCallback(
    (view: TableType) => {
      trackAnalytics('agents-insights.table_view_change', {
        organization,
        view,
      });
      updateQuery({
        view,
        // Clear table cursors and sort order
        tableCursor: undefined,
        field: undefined,
        order: undefined,
      });
    },
    [organization, updateQuery]
  );

  return {activeTable, onActiveTableChange};
}
