import {createContext} from 'react';

import {Series} from 'sentry/types/echarts';
import {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';

export type WidgetViewerContextProps = {
  setData: (data: {
    pageLinks?: string;
    seriesData?: Series[];
    tableData?: TableDataWithTitle[];
    totalIssuesCount?: string;
  }) => void;
  pageLinks?: string;
  seriesData?: Series[];
  tableData?: TableDataWithTitle[];
  totalIssuesCount?: string;
};

export const WidgetViewerContext = createContext<WidgetViewerContextProps>({
  setData: () => undefined,
});
