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

import {
  getAbsoluteDateTimeRange,
  useInstantRef,
  useUpdateQuery,
} from 'sentry/utils/metrics';
import {emptyWidget} from 'sentry/utils/metrics/constants';
import type {MetricWidgetQueryParams} from 'sentry/utils/metrics/types';
import {decodeInteger, decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import type {FocusAreaSelection} from 'sentry/views/ddm/focusArea';
import {parseMetricWidgetsQueryParam} from 'sentry/views/ddm/utils/parseMetricWidgetsQueryParam';
import {useStructuralSharing} from 'sentry/views/ddm/utils/useStructuralSharing';

export type FocusAreaProps = {
  onAdd?: (area: FocusAreaSelection) => void;
  onDraw?: () => void;
  onRemove?: () => void;
  selection?: FocusAreaSelection;
};

interface DDMContextValue {
  addWidget: () => void;
  duplicateWidget: (index: number) => void;
  hasMetrics: boolean;
  isDefaultQuery: boolean;
  isMultiChartMode: boolean;
  removeWidget: (index: number) => void;
  selectedWidgetIndex: number;
  setDefaultQuery: (query: Record<string, any> | null) => void;
  setHighlightedSampleId: (sample?: string) => void;
  setIsMultiChartMode: (value: boolean) => void;
  setSelectedWidgetIndex: (index: number) => void;
  showQuerySymbols: boolean;
  updateWidget: (index: number, data: Partial<MetricWidgetQueryParams>) => void;
  widgets: MetricWidgetQueryParams[];
  focusArea?: FocusAreaProps;
  highlightedSampleId?: string;
}

export const DDMContext = createContext<DDMContextValue>({
  addWidget: () => {},
  duplicateWidget: () => {},
  focusArea: undefined,
  hasMetrics: false,
  highlightedSampleId: undefined,
  isDefaultQuery: false,
  isMultiChartMode: false,
  removeWidget: () => {},
  selectedWidgetIndex: 0,
  setDefaultQuery: () => {},
  setHighlightedSampleId: () => {},
  setIsMultiChartMode: () => {},
  setSelectedWidgetIndex: () => {},
  showQuerySymbols: false,
  updateWidget: () => {},
  widgets: [],
});

export function useDDMContext() {
  return useContext(DDMContext);
}

const DEFAULT_WIDGETS_STATE: MetricWidgetQueryParams[] = [emptyWidget];

export function useMetricWidgets() {
  const {widgets: urlWidgets} = useLocationQuery({fields: {widgets: decodeScalar}});
  const updateQuery = useUpdateQuery();

  const widgets = useStructuralSharing(
    useMemo<MetricWidgetQueryParams[]>(
      () => parseMetricWidgetsQueryParam(urlWidgets) ?? DEFAULT_WIDGETS_STATE,
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
    setWidgets(currentWidgets => {
      const lastWidget = currentWidgets.length
        ? currentWidgets[currentWidgets.length - 1]
        : {};

      const newWidget = {
        ...emptyWidget,
        ...lastWidget,
      };

      return [...currentWidgets, newWidget];
    });
  }, [setWidgets]);

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
    removeWidget,
    duplicateWidget,
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

  const [highlightedSampleId, setHighlightedSampleId] = useState<string | undefined>();

  const pageFilters = usePageFilters().selection;

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

      const dateRange = getAbsoluteDateTimeRange(pageFilters.datetime);
      if (area.range.end < dateRange.start || area.range.start > dateRange.end) {
        Sentry.metrics.increment('ddm.enhance.range-outside');
        return;
      }

      Sentry.metrics.increment('ddm.enhance.add');
      handleSetSelectedWidgetIndex(area.widgetIndex);
      updateQuery({focusArea: JSON.stringify(area)}, {replace: true});
    },
    [pageFilters.datetime, handleSetSelectedWidgetIndex, updateQuery]
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

  const handleAddWidget = useCallback(() => {
    addWidget();
    handleSetSelectedWidgetIndex(widgets.length);
  }, [addWidget, handleSetSelectedWidgetIndex, widgets.length]);

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
      setSelectedWidgetIndex(0);
    },
    [updateQuery, updateWidget]
  );

  const contextValue = useMemo<DDMContextValue>(
    () => ({
      addWidget: handleAddWidget,
      selectedWidgetIndex:
        selectedWidgetIndex > widgets.length - 1 ? 0 : selectedWidgetIndex,
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
    }),
    [
      handleAddWidget,
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
    ]
  );

  return <DDMContext.Provider value={contextValue}>{children}</DDMContext.Provider>;
}
