import {createContext} from 'react';

import {Series} from 'sentry/types/echarts';
import {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {AggregationOutputType} from 'sentry/utils/discover/fields';

export type WidgetViewerContextProps = {
  setData: (data: {
    pageLinks?: string;
    seriesData?: Series[];
    seriesResultsType?: Record<string, AggregationOutputType>;
    tableData?: TableDataWithTitle[];
    totalIssuesCount?: string;
  }) => void;
  pageLinks?: string;
  seriesData?: Series[];
  seriesResultsType?: Record<string, AggregationOutputType>;
  tableData?: TableDataWithTitle[];
  totalIssuesCount?: string;
};

export const WidgetViewerContext = createContext<WidgetViewerContextProps>({
  setData: () => undefined,
});
