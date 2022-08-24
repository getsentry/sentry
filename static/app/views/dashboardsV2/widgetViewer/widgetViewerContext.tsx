import {createContext} from 'react';

import type {Series} from 'sentry/types/echarts';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';

export type WidgetViewerContextProps = {
  setData: (data: {
    pageLinks?: string;
    seriesData?: Series[];
    seriesResultsType?: string;
    tableData?: TableDataWithTitle[];
    totalIssuesCount?: string;
  }) => void;
  pageLinks?: string;
  seriesData?: Series[];
  seriesResultsType?: string;
  tableData?: TableDataWithTitle[];
  totalIssuesCount?: string;
};

export const WidgetViewerContext = createContext<WidgetViewerContextProps>({
  setData: () => undefined,
});
