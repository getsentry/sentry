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

import type {FocusAreaSelection} from 'sentry/components/metrics/chart/types';
import type {Field} from 'sentry/components/metrics/metricSamplesTable';
import type {MetricMeta} from 'sentry/types/metrics';
import {useInstantRef, useUpdateQuery} from 'sentry/utils/metrics';
import {
  emptyMetricsFormulaWidget,
  emptyMetricsQueryWidget,
  NO_QUERY_ID,
} from 'sentry/utils/metrics/constants';
import {
  isMetricsQueryWidget,
  MetricExpressionType,
  type MetricsWidget,
} from 'sentry/utils/metrics/types';
import {useVirtualizedMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import type {MetricsSamplesResults} from 'sentry/utils/metrics/useMetricsSamples';
import {useVirtualMetricsContext} from 'sentry/utils/metrics/virtualMetricsContext';
import {decodeInteger, decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {getNewMetricsWidget} from 'sentry/views/metrics/utils/getNewMetricsWidget';
import {parseMetricWidgetsQueryParam} from 'sentry/views/metrics/utils/parseMetricWidgetsQueryParam';
import {useStructuralSharing} from 'sentry/views/metrics/utils/useStructuralSharing';

export type FocusAreaProps = {
  onAdd?: (area: FocusAreaSelection) => void;
  onDraw?: () => void;
  onRemove?: () => void;
  selection?: FocusAreaSelection;
};

interface MetricsContextValue {
  addWidget: (type?: MetricExpressionType) => void;
  duplicateWidget: (index: number) => void;
  focusArea: FocusAreaProps;
  hasCustomMetrics: boolean;
  hasPerformanceMetrics: boolean;
  isDefaultQuery: boolean;
  isHasMetricsLoading: boolean;
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
  updateWidget: (index: number, data: Partial<Omit<MetricsWidget, 'type'>>) => void;
  widgets: MetricsWidget[];
  highlightedSampleId?: string;
  metricsSamples?: MetricsSamplesResults<Field>['data'];
}

export const MetricsContext = createContext<MetricsContextValue>({
  addWidget: () => {},
  duplicateWidget: () => {},
  focusArea: {},
  hasCustomMetrics: false,
  hasPerformanceMetrics: false,
  highlightedSampleId: undefined,
  isDefaultQuery: false,
  isMultiChartMode: false,
  isHasMetricsLoading: true,
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

export function useMetricWidgets(
  firstCustomMeta: MetricMeta | undefined,
  defaultCondition?: number
) {
  const {widgets: urlWidgets} = useLocationQuery({fields: {widgets: decodeScalar}});
  const updateQuery = useUpdateQuery();

  const widgets = useStructuralSharing(
    useMemo<MetricsWidget[]>(() => {
      const parseResult = parseMetricWidgetsQueryParam(urlWidgets);
      if (parseResult.length === 0) {
        const widget = getNewMetricsWidget(firstCustomMeta, defaultCondition);
        widget.id = 0;
        return [widget];
      }
      return parseResult;
    }, [defaultCondition, firstCustomMeta, urlWidgets])
  );

  // We want to have it as a ref, so that we can use it in the setWidget callback
  // without needing to generate a new callback every time the location changes
  const currentWidgetsRef = useInstantRef(widgets);

  const setWidgets = useCallback(
    (newWidgets: React.SetStateAction<MetricsWidget[]>) => {
      const currentWidgets = currentWidgetsRef.current;
      const newData =
        typeof newWidgets === 'function' ? newWidgets(currentWidgets) : newWidgets;

      updateQuery({widgets: JSON.stringify(newData)});
      // We need to update the ref so that the next call to setWidgets in the same render cycle will have the updated value
      currentWidgetsRef.current = newData;
    },
    [updateQuery, currentWidgetsRef]
  );

  const updateWidget = useCallback(
    (index: number, data: Partial<Omit<MetricsWidget, 'type'>>) => {
      setWidgets(currentWidgets => {
        const newWidgets = [...currentWidgets];
        const oldWidget = currentWidgets[index];

        if (isMetricsQueryWidget(oldWidget)) {
          // Reset focused series if mri, query or groupBy changes
          if (
            ('mri' in data && data.mri !== oldWidget.mri) ||
            ('query' in data && data.query !== oldWidget.query) ||
            ('groupBy' in data && !isEqual(data.groupBy, oldWidget.groupBy))
          ) {
            data.focusedSeries = undefined;
          }
        }

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
    (type: MetricExpressionType = MetricExpressionType.QUERY) => {
      const lastIndexOfSameType = currentWidgetsRef.current.findLastIndex(
        w => w.type === type
      );
      if (lastIndexOfSameType > -1) {
        duplicateWidget(lastIndexOfSameType);
      } else {
        setWidgets(currentWidgets => [
          ...currentWidgets,
          type === MetricExpressionType.QUERY
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

export function MetricsContextProvider({children}: {children: React.ReactNode}) {
  const router = useRouter();
  const updateQuery = useUpdateQuery();
  const {getConditions} = useVirtualMetricsContext();
  const {multiChartMode} = useLocationQuery({fields: {multiChartMode: decodeInteger}});
  const pageFilters = usePageFilters();
  const {data: metaCustom, isLoading: isMetaCustomLoading} = useVirtualizedMetricsMeta(
    pageFilters.selection,
    ['custom'],
    true,
    pageFilters.isReady
  );
  const {data: metaPerformance, isLoading: isMetaPerformanceLoading} =
    useVirtualizedMetricsMeta(
      pageFilters.selection,
      ['transactions', 'spans'],
      true,
      pageFilters.isReady
    );
  const isMultiChartMode = multiChartMode === 1;
  const firstCustomMetric: MetricMeta | undefined = metaCustom[0];

  const {setDefaultQuery, isDefaultQuery} = useDefaultQuery();

  const [selectedWidgetIndex, setSelectedWidgetIndex] = useState(0);
  const {widgets, updateWidget, addWidget, removeWidget, duplicateWidget, setWidgets} =
    useMetricWidgets(
      firstCustomMetric,
      firstCustomMetric && getConditions(firstCustomMetric.mri)[0]?.id
    );

  const [metricsSamples, setMetricsSamples] = useState<
    MetricsSamplesResults<Field>['data'] | undefined
  >();

  const [highlightedSampleId, setHighlightedSampleId] = useState<string | undefined>();

  const hasCustomMetrics = useMemo(() => {
    return !!metaCustom.length;
  }, [metaCustom]);

  const hasPerformanceMetrics = useMemo(() => {
    return !!metaPerformance.length;
  }, [metaPerformance]);

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
    (type?: MetricExpressionType) => {
      addWidget(type);
      handleSetSelectedWidgetIndex(widgets.length);
    },
    [addWidget, handleSetSelectedWidgetIndex, widgets.length]
  );

  const handleUpdateWidget = useCallback(
    (index: number, data: Partial<MetricsWidget>) => {
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
      if (!isMultiChartMode) {
        // Reset the focused series when hiding a widget
        setWidgets(currentWidgets => {
          return currentWidgets.map(w => ({...w, focusedSeries: undefined}));
        });
      }
      updateWidget(index, {isHidden: !widgets[index].isHidden});
    },
    [isMultiChartMode, selectedWidgetIndex, setWidgets, updateWidget, widgets]
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
      hasCustomMetrics,
      hasPerformanceMetrics,
      isHasMetricsLoading: isMetaCustomLoading || isMetaPerformanceLoading,
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
      hasCustomMetrics,
      hasPerformanceMetrics,
      focusArea,
      setDefaultQuery,
      isDefaultQuery,
      highlightedSampleId,
      isMultiChartMode,
      handleSetIsMultiChartMode,
      metricsSamples,
      toggleWidgetVisibility,
      isMetaCustomLoading,
      isMetaPerformanceLoading,
    ]
  );

  return (
    <MetricsContext.Provider value={contextValue}>{children}</MetricsContext.Provider>
  );
}
