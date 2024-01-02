import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as Sentry from '@sentry/react';

import {MRI} from 'sentry/types';
import {
  defaultMetricDisplayType,
  MetricDisplayType,
  MetricWidgetQueryParams,
  useInstantRef,
  useUpdateQuery,
} from 'sentry/utils/metrics';
import {parseMRI} from 'sentry/utils/metrics/mri';
import {useMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {decodeList} from 'sentry/utils/queryString';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {FocusArea} from 'sentry/views/ddm/chartBrush';
import {DEFAULT_SORT_STATE} from 'sentry/views/ddm/constants';
import {useStructuralSharing} from 'sentry/views/ddm/useStructuralSharing';

interface DDMContextValue {
  addFocusArea: (area: FocusArea) => void;
  addWidget: () => void;
  addWidgets: (widgets: Partial<MetricWidgetQueryParams>[]) => void;
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
  addWidgets: () => {},
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
  const updateQuery = useUpdateQuery();

  const widgets = useStructuralSharing(
    useMemo<MetricWidgetQueryParams[]>(() => {
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
    }, [router.location.query.widgets])
  );

  // We want to have it as a ref, so that we can use it in the setWidget callback
  // without needing to generate a new callback every time the location changes
  const currentWidgetsRef = useInstantRef(widgets);

  const setWidgets = useCallback(
    (newWidgets: React.SetStateAction<MetricWidgetQueryParams[]>) => {
      const currentWidgets = currentWidgetsRef.current;
      updateQuery({
        widgets: JSON.stringify(
          typeof newWidgets === 'function' ? newWidgets(currentWidgets) : newWidgets
        ),
      });
    },
    [updateQuery, currentWidgetsRef]
  );

  const updateWidget = useCallback(
    (index: number, data: Partial<MetricWidgetQueryParams>) => {
      setWidgets(currentWidgets => {
        const newWidgets = [...currentWidgets];
        newWidgets[index] = {...currentWidgets[index], ...data};
        return newWidgets;
      });
    },
    [setWidgets]
  );

  const addWidget = useCallback(() => {
    setWidgets(currentWidgets => [...currentWidgets, emptyWidget]);
  }, [setWidgets]);

  const addWidgets = useCallback(
    (newWidgets: Partial<MetricWidgetQueryParams>[]) => {
      const widgetsCopy = [...widgets].filter(widget => !!widget.mri);
      widgetsCopy.push(...newWidgets.map(widget => ({...emptyWidget, ...widget})));

      setWidgets(widgetsCopy);
    },
    [widgets, setWidgets]
  );

  const removeWidget = useCallback(
    (index: number) => {
      setWidgets(currentWidgets => {
        const newWidgets = [...currentWidgets];
        newWidgets.splice(index, 1);
        return newWidgets;
      });
    },
    [setWidgets]
  );

  const duplicateWidget = useCallback(
    (index: number) => {
      setWidgets(currentWidgets => {
        const newWidgets = [...currentWidgets];
        newWidgets.splice(index, 0, currentWidgets[index]);
        return newWidgets;
      });
    },
    [setWidgets]
  );

  return {
    widgets,
    updateWidget,
    addWidget,
    addWidgets,
    removeWidget,
    duplicateWidget,
  };
}

export function DDMContextProvider({children}: {children: React.ReactNode}) {
  const router = useRouter();
  const updateQuery = useUpdateQuery();

  const [selectedWidgetIndex, setSelectedWidgetIndex] = useState(0);
  const {widgets, updateWidget, addWidget, addWidgets, removeWidget, duplicateWidget} =
    useMetricWidgets();
  const [focusArea, setFocusArea] = useState<FocusArea | null>(null);

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
      Sentry.metrics.increment('ddm.enhance.add');
      setFocusArea(area);
      setSelectedWidgetIndex(area.widgetIndex);
      updateQuery({focusArea: JSON.stringify(area)});
    },
    [updateQuery]
  );

  const handleRemoveFocusArea = useCallback(() => {
    Sentry.metrics.increment('ddm.enhance.remove');
    setFocusArea(null);
    updateQuery({focusArea: null});
  }, [updateQuery]);

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
      addWidgets,
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
      addWidgets,
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
