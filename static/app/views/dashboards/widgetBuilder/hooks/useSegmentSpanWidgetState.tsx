import {useCallback} from 'react';

import {WidgetType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderStore} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {convertBuilderStateToStateQueryParams} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToStateQueryParams';

export function useSegmentSpanWidgetState() {
  // The state is only read inside the returned callback, so use the store
  // directly instead of subscribing to every state change
  const store = useWidgetBuilderStore();

  const setSegmentSpanBuilderState = useCallback(() => {
    const nextDataset = WidgetType.SPANS;
    const stateParams = convertBuilderStateToStateQueryParams(store.getState());
    store.dispatch({
      type: BuilderStateAction.SET_STATE,
      payload: {
        ...stateParams,
        dataset: nextDataset,
        query: ['is_transaction:true'],
      },
    });
  }, [store]);

  return {
    setSegmentSpanBuilderState,
  };
}
