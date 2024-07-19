import {createContext} from 'react';

import type {Series} from 'sentry/types/echarts';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';

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
