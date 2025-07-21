import {useCallback} from 'react';

import {WidgetType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {convertBuilderStateToWidget} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';
import {convertWidgetToBuilderStateParams} from 'sentry/views/dashboards/widgetBuilder/utils/convertWidgetToBuilderStateParams';

export function useSegmentSpanWidgetState() {
  const {dispatch, state} = useWidgetBuilderContext();

  const setSegmentSpanBuilderState = useCallback(() => {
    const nextDataset = WidgetType.SPANS;
    const widget = convertBuilderStateToWidget(state);
    const stateParams = convertWidgetToBuilderStateParams(widget);
    dispatch({
      type: BuilderStateAction.SET_STATE,
      payload: {...stateParams, dataset: nextDataset, query: ['is_transaction:true']},
    });
  }, [dispatch, state]);

  return {
    setSegmentSpanBuilderState,
  };
}
