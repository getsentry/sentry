import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as Sentry from '@sentry/react';
import isEqual from 'lodash/isEqual';

import type {Field} from 'sentry/components/ddm/metricSamplesTable';
import {useInstantRef, useUpdateQuery} from 'sentry/utils/metrics';
import {
  emptyMetricsFormulaWidget,
  emptyMetricsQueryWidget,
  NO_QUERY_ID,
} from 'sentry/utils/metrics/constants';
import {MetricQueryType, type MetricWidgetQueryParams} from 'sentry/utils/metrics/types';
import type {MetricsSamplesResults} from 'sentry/utils/metrics/useMetricsSamples';
import {decodeInteger, decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import type {FocusAreaSelection} from 'sentry/views/metrics/chart/types';
import {parseMetricWidgetsQueryParam} from 'sentry/views/metrics/utils/parseMetricWidgetsQueryParam';
import {useStructuralSharing} from 'sentry/views/metrics/utils/useStructuralSharing';

export type FocusAreaProps = {
  onAdd?: (area: FocusAreaSelection) => void;
  onDraw?: () => void;
  onRemove?: () => void;
  selection?: FocusAreaSelection;
};

interface MetricsContextValue {
  addWidget: (type?: MetricQueryType) => void;
  duplicateWidget: (index: number) => void;
  focusArea: FocusAreaProps;
  hasMetrics: boolean;
  isDefaultQuery: boolean;
  isMultiChartMode: boolean;
  removeWidget: (index: number) => void;
  selectedWidgetIndex: number;
  setDefaultQuery: (query: Record<string, any> | null) => void;
  setHighlightedSampleId: (sample?: string) => void;
  setIsMultiChartMode: (value: boolean) => void;
  setMetricsSamples: React.Dispatch<
    React.SetStateAction<MetricsSamplesResults<Field>['data'] | undefined>
  >;
  setSelectedWidgetIndex: (index: number) => void;
  showQuerySymbols: boolean;
  toggleWidgetVisibility: (index: number) => void;
  updateWidget: (
    index: number,
    data: Partial<Omit<MetricWidgetQueryParams, 'type'>>
  ) => void;
  widgets: MetricWidgetQueryParams[];
  highlightedSampleId?: string;
  metricsSamples?: MetricsSamplesResults<Field>['data'];
}

export const MetricsContext = createContext<MetricsContextValue>({
  addWidget: () => {},
  duplicateWidget: () => {},
  focusArea: {},
  hasMetrics: false,
  highlightedSampleId: undefined,
  isDefaultQuery: false,
  isMultiChartMode: false,
  metricsSamples: [],
  removeWidget: () => {},
  selectedWidgetIndex: 0,
  setDefaultQuery: () => {},
  setHighlightedSampleId: () => {},
  setIsMultiChartMode: () => {},
  setMetricsSamples: () => {},
  setSelectedWidgetIndex: () => {},
  showQuerySymbols: false,
  updateWidget: () => {},
  widgets: [],
  toggleWidgetVisibility: () => {},
});

export function useMetricsContext() {
  return useContext(MetricsContext);
}

export function useMetricWidgets() {
  const {widgets: urlWidgets} = useLocationQuery({fields: {widgets: decodeScalar}});
  const updateQuery = useUpdateQuery();

  const widgets = useStructuralSharing(
    useMemo<MetricWidgetQueryParams[]>(
      () => parseMetricWidgetsQueryParam(urlWidgets),
      [urlWidgets]
    )
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
    (index: number, data: Partial<Omit<MetricWidgetQueryParams, 'type'>>) => {
      setWidgets(currentWidgets => {
        const newWidgets = [...currentWidgets];
        newWidgets[index] = {
          ...currentWidgets[index],
          ...data,
        };
        return newWidgets;
      });
    },
    [setWidgets]
  );

  const duplicateWidget = useCallback(
    (index: number) => {
      setWidgets(currentWidgets => {
        const newWidgets = [...currentWidgets];
        const newWidget = {...currentWidgets[index]};
        newWidget.id = NO_QUERY_ID;
        newWidgets.splice(index + 1, 0, newWidget);
        return newWidgets;
      });
    },
    [setWidgets]
  );

  const addWidget = useCallback(
    (type: MetricQueryType = MetricQueryType.QUERY) => {
      const lastIndexOfSameType = currentWidgetsRef.current.findLastIndex(
        w => w.type === type
      );
      if (lastIndexOfSameType > -1) {
        duplicateWidget(lastIndexOfSameType);
      } else {
        setWidgets(currentWidgets => [
          ...currentWidgets,
          type === MetricQueryType.QUERY
            ? emptyMetricsQueryWidget
            : emptyMetricsFormulaWidget,
        ]);
      }
    },
    [currentWidgetsRef, duplicateWidget, setWidgets]
  );

  const removeWidget = useCallback(
    (index: number) => {
      setWidgets(currentWidgets => {
        let newWidgets = [...currentWidgets];
        newWidgets.splice(index, 1);

        // Ensure that a visible widget remains
        if (!newWidgets.find(w => !w.isHidden)) {
          newWidgets = newWidgets.map(w => ({...w, isHidden: false}));
        }
        return newWidgets;
      });
    },
    [setWidgets]
  );

  return {
    widgets,
    updateWidget,
    addWidget,
    removeWidget,
    duplicateWidget,
    setWidgets,
  };
}

const useDefaultQuery = () => {
  const router = useRouter();
  const [defaultQuery, setDefaultQuery] = useLocalStorageState<Record<
    string,
    any
  > | null>('ddm:default-query', null);

  useEffect(() => {
    if (defaultQuery && router.location.query.widgets === undefined) {
      router.replace({...router.location, query: defaultQuery});
    }
    // Only call on page load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useMemo(
    () => ({
      defaultQuery,
      setDefaultQuery,
      isDefaultQuery: !!defaultQuery && isEqual(defaultQuery, router.location.query),
    }),
    [defaultQuery, router.location.query, setDefaultQuery]
  );
};

function useSelectedProjects() {
  const {selection} = usePageFilters();
  const {projects} = useProjects();

  return useMemo(() => {
    if (selection.projects.length === 0) {
      return projects.filter(project => project.isMember);
    }
    if (selection.projects.includes(-1)) {
      return projects;
    }
    return projects.filter(project => selection.projects.includes(Number(project.id)));
  }, [selection.projects, projects]);
}

export function DDMContextProvider({children}: {children: React.ReactNode}) {
  const router = useRouter();
  const updateQuery = useUpdateQuery();
  const {multiChartMode} = useLocationQuery({fields: {multiChartMode: decodeInteger}});
  const isMultiChartMode = multiChartMode === 1;

  const {setDefaultQuery, isDefaultQuery} = useDefaultQuery();

  const [selectedWidgetIndex, setSelectedWidgetIndex] = useState(0);
  const {widgets, updateWidget, addWidget, removeWidget, duplicateWidget} =
    useMetricWidgets();

  const [metricsSamples, setMetricsSamples] = useState<
    MetricsSamplesResults<Field>['data'] | undefined
  >();

  const [highlightedSampleId, setHighlightedSampleId] = useState<string | undefined>();

  const selectedProjects = useSelectedProjects();
  const hasMetrics = useMemo(
    () =>
      selectedProjects.some(
        project =>
          project.hasCustomMetrics || project.hasSessions || project.firstTransactionEvent
      ),
    [selectedProjects]
  );

  const handleSetSelectedWidgetIndex = useCallback(
    (value: number) => {
      if (!isMultiChartMode) {
        return;
      }
      setSelectedWidgetIndex(value);
    },
    [isMultiChartMode]
  );

  const focusAreaSelection = useMemo<FocusAreaSelection | undefined>(
    () => router.location.query.focusArea && JSON.parse(router.location.query.focusArea),
    [router.location.query.focusArea]
  );

  const handleAddFocusArea = useCallback(
    (area: FocusAreaSelection) => {
      if (!area.range.start || !area.range.end) {
        Sentry.metrics.increment('ddm.enhance.range-undefined');
        return;
      }
      Sentry.metrics.increment('ddm.enhance.add');
      handleSetSelectedWidgetIndex(area.widgetIndex);
      updateQuery({focusArea: JSON.stringify(area)}, {replace: true});
    },
    [handleSetSelectedWidgetIndex, updateQuery]
  );

  const handleRemoveFocusArea = useCallback(() => {
    Sentry.metrics.increment('ddm.enhance.remove');
    updateQuery({focusArea: undefined}, {replace: true});
  }, [updateQuery]);

  const focusArea = useMemo<FocusAreaProps>(() => {
    return {
      selection: focusAreaSelection,
      onAdd: handleAddFocusArea,
      onRemove: handleRemoveFocusArea,
    };
  }, [focusAreaSelection, handleAddFocusArea, handleRemoveFocusArea]);

  const handleAddWidget = useCallback(
    (type?: MetricQueryType) => {
      addWidget(type);
      handleSetSelectedWidgetIndex(widgets.length);
    },
    [addWidget, handleSetSelectedWidgetIndex, widgets.length]
  );

  const handleUpdateWidget = useCallback(
    (index: number, data: Partial<MetricWidgetQueryParams>) => {
      updateWidget(index, data);
      handleSetSelectedWidgetIndex(index);
      if (index === focusAreaSelection?.widgetIndex) {
        handleRemoveFocusArea();
      }
    },
    [
      updateWidget,
      handleSetSelectedWidgetIndex,
      focusAreaSelection?.widgetIndex,
      handleRemoveFocusArea,
    ]
  );

  const handleDuplicate = useCallback(
    (index: number) => {
      duplicateWidget(index);
      handleSetSelectedWidgetIndex(index + 1);
    },
    [duplicateWidget, handleSetSelectedWidgetIndex]
  );

  const handleSetIsMultiChartMode = useCallback(
    (value: boolean) => {
      updateQuery({multiChartMode: value ? 1 : 0}, {replace: true});
      updateWidget(0, {focusedSeries: undefined});
      const firstVisibleWidgetIndex = widgets.findIndex(w => !w.isHidden);
      setSelectedWidgetIndex(firstVisibleWidgetIndex);
    },
    [updateQuery, updateWidget, widgets]
  );

  const toggleWidgetVisibility = useCallback(
    (index: number) => {
      if (index === selectedWidgetIndex) {
        const firstVisibleWidgetIndex = widgets.findIndex(w => !w.isHidden);
        setSelectedWidgetIndex(firstVisibleWidgetIndex);
      }
      updateWidget(index, {isHidden: !widgets[index].isHidden});
    },
    [selectedWidgetIndex, updateWidget, widgets]
  );

  const selectedWidget = widgets[selectedWidgetIndex];
  const isSelectionValid = selectedWidget && !selectedWidget.isHidden;

  const contextValue = useMemo<MetricsContextValue>(
    () => ({
      addWidget: handleAddWidget,
      selectedWidgetIndex: isSelectionValid
        ? selectedWidgetIndex
        : widgets.findIndex(w => !w.isHidden),
      setSelectedWidgetIndex: handleSetSelectedWidgetIndex,
      updateWidget: handleUpdateWidget,
      removeWidget,
      duplicateWidget: handleDuplicate,
      widgets,
      hasMetrics,
      focusArea,
      setDefaultQuery,
      isDefaultQuery,
      showQuerySymbols: widgets.length > 1,
      highlightedSampleId,
      setHighlightedSampleId,
      isMultiChartMode: isMultiChartMode,
      setIsMultiChartMode: handleSetIsMultiChartMode,
      metricsSamples,
      setMetricsSamples,
      toggleWidgetVisibility,
    }),
    [
      handleAddWidget,
      isSelectionValid,
      selectedWidgetIndex,
      widgets,
      handleSetSelectedWidgetIndex,
      handleUpdateWidget,
      removeWidget,
      handleDuplicate,
      hasMetrics,
      focusArea,
      setDefaultQuery,
      isDefaultQuery,
      highlightedSampleId,
      isMultiChartMode,
      handleSetIsMultiChartMode,
      metricsSamples,
      toggleWidgetVisibility,
    ]
  );

  return (
    <MetricsContext.Provider value={contextValue}>{children}</MetricsContext.Provider>
  );
}
