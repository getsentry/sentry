import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {MRI} from 'sentry/types';
import {
  defaultMetricDisplayType,
  MetricDisplayType,
  MetricWidgetQueryParams,
  updateQuery,
} from 'sentry/utils/metrics';
import {parseMRI} from 'sentry/utils/metrics/mri';
import {useMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {decodeList} from 'sentry/utils/queryString';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {FocusArea} from 'sentry/views/ddm/chartBrush';
import {DEFAULT_SORT_STATE} from 'sentry/views/ddm/constants';

interface DDMContextValue {
  addFocusArea: (area: FocusArea) => void;
  addWidget: () => void;
  duplicateWidget: (index: number) => void;
  focusArea: FocusArea | null;
  hasCustomMetrics: boolean;
  isLoading: boolean;
  metricsMeta: ReturnType<typeof useMetricsMeta>['data'];
  removeFocusArea: () => void;
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
  addFocusArea: () => {},
  removeFocusArea: () => {},
  duplicateWidget: () => {},
  widgets: [],
  metricsMeta: [],
  hasCustomMetrics: false,
  isLoading: false,
  focusArea: null,
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
  title: undefined,
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
        title: widget.title,
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
  const router = useRouter();

  const [selectedWidgetIndex, setSelectedWidgetIndex] = useState(0);
  const [focusArea, setFocusArea] = useState<FocusArea | null>(null);

  const {widgets, updateWidget, addWidget, removeWidget, duplicateWidget} =
    useMetricWidgets();

  const pageFilters = usePageFilters().selection;

  const {data: metricsMeta, isLoading} = useMetricsMeta(pageFilters.projects);

  // TODO(telemetry-experience): Switch to the logic below once we have the hasCustomMetrics flag on project
  // const {projects} = useProjects();
  // const selectedProjects = projects.filter(project =>
  //   pageFilters.projects.includes(parseInt(project.id, 10))
  // );
  // const hasCustomMetrics = selectedProjects.some(project => project.hasCustomMetrics);
  const hasCustomMetrics = !!metricsMeta.find(
    meta => parseMRI(meta)?.useCase === 'custom'
  );

  const handleAddFocusArea = useCallback(
    (area: FocusArea) => {
      setFocusArea(area);
      setSelectedWidgetIndex(area.widgetIndex);
      updateQuery(router, {focusArea: JSON.stringify(area)});
    },
    [router]
  );

  const handleRemoveFocusArea = useCallback(() => {
    setFocusArea(null);
    updateQuery(router, {focusArea: null});
  }, [router]);

  // Load focus area from URL
  useEffect(() => {
    if (focusArea) {
      return;
    }
    const urlFocusArea = router.location.query.focusArea;
    if (urlFocusArea) {
      handleAddFocusArea(JSON.parse(urlFocusArea));
    }
  }, [router, handleAddFocusArea, focusArea]);

  const handleAddWidget = useCallback(() => {
    addWidget();
    setSelectedWidgetIndex(widgets.length);
  }, [addWidget, widgets.length]);

  const handleUpdateWidget = useCallback(
    (index: number, data: Partial<MetricWidgetQueryParams>) => {
      updateWidget(index, data);
      setSelectedWidgetIndex(index);
      if (index === focusArea?.widgetIndex) {
        handleRemoveFocusArea();
      }
    },
    [updateWidget, handleRemoveFocusArea, focusArea?.widgetIndex]
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
      hasCustomMetrics,
      isLoading,
      metricsMeta,
      focusArea,
      addFocusArea: handleAddFocusArea,
      removeFocusArea: handleRemoveFocusArea,
    }),
    [
      handleAddWidget,
      handleDuplicate,
      handleUpdateWidget,
      removeWidget,
      hasCustomMetrics,
      isLoading,
      metricsMeta,
      selectedWidgetIndex,
      widgets,
      focusArea,
      handleAddFocusArea,
      handleRemoveFocusArea,
    ]
  );

  return <DDMContext.Provider value={contextValue}>{children}</DDMContext.Provider>;
}
