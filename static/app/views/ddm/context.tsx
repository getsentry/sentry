import {createContext, useCallback, useContext, useMemo, useState} from 'react';

import {MRI} from 'sentry/types';
import {
  defaultMetricDisplayType,
  MetricDisplayType,
  MetricWidgetQueryParams,
  updateQuery,
} from 'sentry/utils/metrics';
import {decodeList} from 'sentry/utils/queryString';
import useRouter from 'sentry/utils/useRouter';
import {DEFAULT_SORT_STATE} from 'sentry/views/ddm/constants';

interface DDMContextValue {
  addWidget: () => void;
  selectedWidgetIndex: number;
  setSelectedWidgetIndex: (index: number) => void;
  updateWidget: (index: number, data: Partial<MetricWidgetQueryParams>) => void;
  widgets: MetricWidgetQueryParams[];
}

export const DDMContext = createContext<DDMContextValue>({
  selectedWidgetIndex: 0,
  setSelectedWidgetIndex: () => {},
  addWidget: () => {},
  updateWidget: () => {},
  widgets: [],
});

export function useDDMContext() {
  const context = useContext(DDMContext);
  if (!context) {
    throw new Error('useDDMContext must be used within a DDMContextProvider');
  }
  return context;
}

const emptyWidget: MetricWidgetQueryParams = {
  mri: '' as MRI,
  op: undefined,
  query: '',
  groupBy: [],
  sort: DEFAULT_SORT_STATE,
  displayType: MetricDisplayType.LINE,
};

export function useMetricWidgets() {
  const router = useRouter();

  const widgets = useMemo<MetricWidgetQueryParams[]>(() => {
    const currentWidgets = JSON.parse(
      router.location.query.widgets ?? JSON.stringify([emptyWidget])
    );

    return currentWidgets.map((widget: MetricWidgetQueryParams) => {
      return {
        mri: widget.mri,
        op: widget.op,
        query: widget.query,
        groupBy: decodeList(widget.groupBy),
        displayType: widget.displayType ?? defaultMetricDisplayType,
        focusedSeries: widget.focusedSeries,
        showSummaryTable: widget.showSummaryTable ?? true, // temporary default
        powerUserMode: widget.powerUserMode,
        sort: widget.sort ?? DEFAULT_SORT_STATE,
      };
    });
  }, [router.location.query.widgets]);

  const updateWidget = useCallback(
    (index: number, data: Partial<MetricWidgetQueryParams>) => {
      const widgetsCopy = [...widgets];
      widgetsCopy[index] = {...widgets[index], ...data};

      updateQuery(router, {
        widgets: JSON.stringify(widgetsCopy),
      });
    },
    [widgets, router]
  );

  const addWidget = useCallback(() => {
    const widgetsCopy = [...widgets];
    widgetsCopy.push(emptyWidget);

    updateQuery(router, {
      widgets: JSON.stringify(widgetsCopy),
    });
  }, [widgets, router]);

  return {
    widgets,
    updateWidget,
    addWidget,
  };
}

export function DDMContextProvider({children}: {children: React.ReactNode}) {
  const [selectedWidgetIndex, setSelectedWidgetIndex] = useState(0);
  const {widgets, updateWidget, addWidget} = useMetricWidgets();

  const handleAddWidget = useCallback(() => {
    addWidget();
    setSelectedWidgetIndex(widgets.length);
  }, [addWidget, widgets.length]);

  const handleUpdateWidget = useCallback(
    (index: number, data: Partial<MetricWidgetQueryParams>) => {
      updateWidget(index, data);
      setSelectedWidgetIndex(index);
    },
    [updateWidget]
  );

  const contextValue = useMemo<DDMContextValue>(
    () => ({
      addWidget: handleAddWidget,
      selectedWidgetIndex:
        selectedWidgetIndex > widgets.length - 1 ? 0 : selectedWidgetIndex,
      setSelectedWidgetIndex,
      updateWidget: handleUpdateWidget,
      widgets,
    }),
    [handleAddWidget, handleUpdateWidget, selectedWidgetIndex, widgets]
  );

  return <DDMContext.Provider value={contextValue}>{children}</DDMContext.Provider>;
}
