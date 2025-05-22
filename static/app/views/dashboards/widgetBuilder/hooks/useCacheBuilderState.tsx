import {useCallback, useEffect} from 'react';

import type {WidgetType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {convertBuilderStateToWidget} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';
import {convertWidgetToBuilderStateParams} from 'sentry/views/dashboards/widgetBuilder/utils/convertWidgetToBuilderStateParams';

const WIDGET_BUILDER_DATASET_STATE_KEY = 'dashboards:widget-builder:dataset';

function cleanUpDatasetState() {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(WIDGET_BUILDER_DATASET_STATE_KEY)) {
      localStorage.removeItem(key);
    }
  }
}

/**
 * This hook is used to cache the builder state for the given dataset
 * and restore it when the user navigates back to the same dataset.
 */
export function useCacheBuilderState() {
  const {state, dispatch} = useWidgetBuilderContext();

  useEffect(() => {
    return cleanUpDatasetState;
  }, []);

  const cacheBuilderState = useCallback(
    (dataset: WidgetType) => {
      localStorage.setItem(
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
      const previousDatasetState = localStorage.getItem(
        `${WIDGET_BUILDER_DATASET_STATE_KEY}:${nextDataset}`
      );
      if (previousDatasetState) {
        const builderState = convertWidgetToBuilderStateParams(
          JSON.parse(previousDatasetState)
        );
        dispatch({
          type: BuilderStateAction.SET_STATE,
          payload: {...builderState, title: state.title},
        });
      } else {
        dispatch({
          type: BuilderStateAction.SET_DATASET,
          payload: nextDataset,
        });
      }
    },
    [dispatch, state.title]
  );

  return {
    cacheBuilderState,
    restoreOrSetBuilderState,
  };
}
