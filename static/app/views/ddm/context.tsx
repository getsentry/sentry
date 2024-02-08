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
  getDefaultMetricDisplayType,
  useInstantRef,
  useUpdateQuery,
} from 'sentry/utils/metrics';
import {DEFAULT_SORT_STATE, emptyWidget} from 'sentry/utils/metrics/constants';
import type {MetricWidgetQueryParams} from 'sentry/utils/metrics/types';
import {decodeList} from 'sentry/utils/queryString';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import type {FocusAreaSelection} from 'sentry/views/ddm/focusArea';
import {useStructuralSharing} from 'sentry/views/ddm/useStructuralSharing';

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
  removeWidget: (index: number) => void;
  selectedWidgetIndex: number;
  setDefaultQuery: (query: Record<string, any> | null) => void;
  setHighlightedSampleId: (sample?: string) => void;
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
  isDefaultQuery: false,
  hasMetrics: false,
  removeWidget: () => {},
  selectedWidgetIndex: 0,
  setDefaultQuery: () => {},
  setSelectedWidgetIndex: () => {},
  showQuerySymbols: false,
  updateWidget: () => {},
  widgets: [],
  highlightedSampleId: undefined,
  setHighlightedSampleId: () => {},
  focusArea: undefined,
});

export function useDDMContext() {
  return useContext(DDMContext);
}

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
          displayType:
            widget.displayType ?? getDefaultMetricDisplayType(widget.mri, widget.op),
          focusedSeries:
            widget.focusedSeries &&
            // Switch existing focused series to array (it was once a string)
            // TODO: remove this after some time (added 08.02.2024)
            (Array.isArray(widget.focusedSeries)
              ? widget.focusedSeries
              : [widget.focusedSeries]),
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
      setSelectedWidgetIndex(area.widgetIndex);
      updateQuery({focusArea: JSON.stringify(area)}, {replace: true});
    },
    [updateQuery, pageFilters.datetime]
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
    setSelectedWidgetIndex(widgets.length);
  }, [addWidget, widgets.length]);

  const handleUpdateWidget = useCallback(
    (index: number, data: Partial<MetricWidgetQueryParams>) => {
      updateWidget(index, data);
      setSelectedWidgetIndex(index);
      if (index === focusAreaSelection?.widgetIndex) {
        handleRemoveFocusArea();
      }
    },
    [updateWidget, handleRemoveFocusArea, focusAreaSelection?.widgetIndex]
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
      hasMetrics,
      focusArea,
      setDefaultQuery,
      isDefaultQuery,
      showQuerySymbols: widgets.length > 1,
      highlightedSampleId,
      setHighlightedSampleId,
    }),
    [
      handleAddWidget,
      selectedWidgetIndex,
      widgets,
      handleUpdateWidget,
      removeWidget,
      handleDuplicate,
      hasMetrics,
      focusArea,
      setDefaultQuery,
      isDefaultQuery,
      highlightedSampleId,
      setHighlightedSampleId,
    ]
  );

  return <DDMContext.Provider value={contextValue}>{children}</DDMContext.Provider>;
}
