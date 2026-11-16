import {useCallback} from 'react';

import {WidgetType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {convertBuilderStateToStateQueryParams} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToStateQueryParams';

import {BuilderStateAction} from './useWidgetBuilderState';

export function useSegmentSpanWidgetState() {
  const {dispatch, state} = useWidgetBuilderContext();

  const setSegmentSpanBuilderState = useCallback(() => {
    const nextDataset = WidgetType.SPANS;
    const stateParams = convertBuilderStateToStateQueryParams(state);
    dispatch({
      type: BuilderStateAction.SET_STATE,
      payload: {
        ...stateParams,
        dataset: nextDataset,
        query: ['is_transaction:true'],
      },
    });
  }, [dispatch, state]);

  return {
    setSegmentSpanBuilderState,
  };
}
