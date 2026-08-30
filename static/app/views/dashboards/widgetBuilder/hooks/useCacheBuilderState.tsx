import {useCallback, useEffect} from 'react';

import {createStorage} from 'sentry/utils/createStorage';
import {useOrganization} from 'sentry/utils/useOrganization';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {convertBuilderStateToWidget} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';
import {convertWidgetToBuilderState} from 'sentry/views/dashboards/widgetBuilder/utils/convertWidgetToBuilderStateParams';
import {canUseMetricsDashboardTable} from 'sentry/views/explore/metrics/metricsFlags';

const WIDGET_BUILDER_DATASET_STATE_KEY = 'dashboards:widget-builder:dataset';

const STORAGE = createStorage(() => window.sessionStorage);

function cleanUpDatasetState() {
  for (let i = 0; i < STORAGE.length; i++) {
    const key = STORAGE.key(i);
    if (key?.startsWith(WIDGET_BUILDER_DATASET_STATE_KEY)) {
      STORAGE.removeItem(key);
    }
  }
}

/**
 * This hook is used to cache the builder state for the given dataset
 * and restore it when the user navigates back to the same dataset.
 */
export function useCacheBuilderState() {
  const {state, dispatch} = useWidgetBuilderContext();
  const organization = useOrganization();

  useEffect(() => {
    // Remove all cached dataset states when the component mounts
    // to prevent stale data from being used.
    cleanUpDatasetState();

    return cleanUpDatasetState;
  }, []);

  const cacheBuilderState = useCallback(
    (dataset: WidgetType) => {
      STORAGE.setItem(
        `${WIDGET_BUILDER_DATASET_STATE_KEY}:${dataset}`,
        JSON.stringify(convertBuilderStateToWidget(state))
      );
    },
    [state]
  );

  // Checks if there is a cached builder state for the given dataset
  // and restores it if it exists. Otherwise, it sets the dataset.
  const restoreOrSetBuilderState = useCallback(
    (nextDataset: WidgetType) => {
      const previousDatasetState = STORAGE.getItem(
        `${WIDGET_BUILDER_DATASET_STATE_KEY}:${nextDataset}`
      );
      if (previousDatasetState) {
        const cachedWidget = JSON.parse(previousDatasetState);
        const displayType =
          nextDataset === WidgetType.TRACEMETRICS &&
          cachedWidget.displayType === DisplayType.TABLE &&
          !canUseMetricsDashboardTable(organization)
            ? DisplayType.LINE
            : cachedWidget.displayType;
        const builderState = convertWidgetToBuilderState({...cachedWidget, displayType});
        dispatch({
          type: BuilderStateAction.SET_STATE,
          payload: {...builderState, title: state.title, description: state.description},
        });
      } else {
        dispatch({
          type: BuilderStateAction.SET_DATASET,
          payload: nextDataset,
        });
      }
    },
    [dispatch, organization, state.title, state.description]
  );

  return {
    cacheBuilderState,
    restoreOrSetBuilderState,
  };
}
