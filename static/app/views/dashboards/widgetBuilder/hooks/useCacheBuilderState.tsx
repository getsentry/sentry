import {useCallback, useEffect} from 'react';

import {createStorage} from 'sentry/utils/createStorage';
import type {WidgetType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderStore} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {convertBuilderStateToWidget} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';
import {convertWidgetToBuilderState} from 'sentry/views/dashboards/widgetBuilder/utils/convertWidgetToBuilderStateParams';

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
  // The state is only read inside the returned callbacks, so use the store
  // directly instead of subscribing to every state change
  const store = useWidgetBuilderStore();
  const dispatch = store.dispatch;

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
        JSON.stringify(convertBuilderStateToWidget(store.getState()))
      );
    },
    [store]
  );

  // Checks if there is a cached builder state for the given dataset
  // and restores it if it exists. Otherwise, it sets the dataset.
  const restoreOrSetBuilderState = useCallback(
    (nextDataset: WidgetType) => {
      const previousDatasetState = STORAGE.getItem(
        `${WIDGET_BUILDER_DATASET_STATE_KEY}:${nextDataset}`
      );
      if (previousDatasetState) {
        const builderState = convertWidgetToBuilderState(
          JSON.parse(previousDatasetState)
        );
        const {title, description} = store.getState();
        dispatch({
          type: BuilderStateAction.SET_STATE,
          payload: {...builderState, title, description},
        });
      } else {
        dispatch({
          type: BuilderStateAction.SET_DATASET,
          payload: nextDataset,
        });
      }
    },
    [dispatch, store]
  );

  return {
    cacheBuilderState,
    restoreOrSetBuilderState,
  };
}
