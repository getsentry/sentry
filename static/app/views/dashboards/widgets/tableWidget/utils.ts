import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {
  TabularData,
  TabularValueUnit,
} from 'sentry/views/dashboards/widgets/common/types';

export function convertTableDataToTabularData(tableData?: TableData): TabularData {
  return {
    data: tableData?.data ?? [],
    meta: {
      units: tableData?.meta?.units as Record<string, TabularValueUnit>,
      fields: tableData?.meta?.fields,
    },
  };
}
