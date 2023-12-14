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
  duplicateWidget: (index: number) => void;
  removeWidget: (index: number) => void;
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
  removeWidget: () => {},
  duplicateWidget: () => {},
  widgets: [],
});

export function useDDMContext() {
  return useContext(DDMContext);
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

  const setWidgets = useCallback(
    (newWidgets: MetricWidgetQueryParams[]) => {
      updateQuery(router, {
        widgets: JSON.stringify(newWidgets),
      });
    },
    [router]
  );

  const updateWidget = useCallback(
    (index: number, data: Partial<MetricWidgetQueryParams>) => {
      const widgetsCopy = [...widgets];
      widgetsCopy[index] = {...widgets[index], ...data};

      setWidgets(widgetsCopy);
    },
    [widgets, setWidgets]
  );

  const addWidget = useCallback(() => {
    const widgetsCopy = [...widgets];
    widgetsCopy.push(emptyWidget);

    setWidgets(widgetsCopy);
  }, [widgets, setWidgets]);

  const removeWidget = useCallback(
    (index: number) => {
      const widgetsCopy = [...widgets];
      widgetsCopy.splice(index, 1);

      setWidgets(widgetsCopy);
    },
    [setWidgets, widgets]
  );

  const duplicateWidget = useCallback(
    (index: number) => {
      const widgetsCopy = [...widgets];
      widgetsCopy.splice(index, 0, widgets[index]);

      setWidgets(widgetsCopy);
    },
    [setWidgets, widgets]
  );

  return {
    widgets,
    updateWidget,
    addWidget,
    removeWidget,
    duplicateWidget,
  };
}

export function DDMContextProvider({children}: {children: React.ReactNode}) {
  const [selectedWidgetIndex, setSelectedWidgetIndex] = useState(0);
  const {widgets, updateWidget, addWidget, removeWidget, duplicateWidget} =
    useMetricWidgets();

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

  const handleDuplicate = useCallback(
    (index: number) => {
      duplicateWidget(index);
      setSelectedWidgetIndex(index + 1);
    },
    [duplicateWidget]
  );

  const contextValue = useMemo<DDMContextValue>(
    () => ({
      addWidget: handleAddWidget,
      selectedWidgetIndex:
        selectedWidgetIndex > widgets.length - 1 ? 0 : selectedWidgetIndex,
      setSelectedWidgetIndex,
      updateWidget: handleUpdateWidget,
      removeWidget,
      duplicateWidget: handleDuplicate,
      widgets,
    }),
    [
      handleAddWidget,
      handleDuplicate,
      handleUpdateWidget,
      removeWidget,
      selectedWidgetIndex,
      widgets,
    ]
  );

  return <DDMContext.Provider value={contextValue}>{children}</DDMContext.Provider>;
}
