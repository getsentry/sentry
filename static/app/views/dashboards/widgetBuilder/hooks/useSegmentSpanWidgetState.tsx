import {useCallback} from 'react';

import {WidgetType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

export function useSegmentSpanWidgetState() {
  const {dispatch} = useWidgetBuilderContext();

  const setSegmentSpanBuilderState = useCallback(() => {
    const nextDataset = WidgetType.SPANS;
    dispatch({
      type: BuilderStateAction.SET_STATE,
      payload: {dataset: nextDataset, query: ['is_transaction:true']},
    });
  }, [dispatch]);

  return {
    setSegmentSpanBuilderState,
  };
}
