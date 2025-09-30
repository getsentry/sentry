import {useCallback} from 'react';

import {WidgetType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {convertBuilderStateToStateQueryParams} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToStateQueryParams';

export function useSpanEventWidgetState() {
  const {dispatch, state} = useWidgetBuilderContext();

  const setSpanEventBuilderState = useCallback(() => {
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
    setSpanEventBuilderState,
  };
}
