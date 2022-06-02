import {createContext} from 'react';

import {Series} from 'sentry/types/echarts';
import {TableDataRow, TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';

export type WidgetViewerContextProps = {
  setData: (data: {
    issuesData?: TableDataRow[];
    pageLinks?: string;
    seriesData?: Series[];
    tableData?: TableDataWithTitle[];
    totalIssuesCount?: string;
  }) => void;
  issuesData?: TableDataRow[];
  pageLinks?: string;
  seriesData?: Series[];
  tableData?: TableDataWithTitle[];
  totalIssuesCount?: string;
};

export const WidgetViewerContext = createContext<WidgetViewerContextProps>({
  setData: () => undefined,
});
