import {createContext} from 'react';

import {Series} from 'sentry/types/echarts';
import {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';

export type WidgetViewerContextProps = {
  setData: (data: {seriesData?: Series[]; tableData?: TableDataWithTitle[]}) => void;
  seriesData?: Series[];
  tableData?: TableDataWithTitle[];
};

export const WidgetViewerContext = createContext<WidgetViewerContextProps>({
  setData: () => undefined,
  seriesData: undefined,
  tableData: undefined,
});
