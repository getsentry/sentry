import {useEffect, useRef} from 'react';

import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import {Rect} from 'sentry/utils/profiling/speedscope';
import usePrevious from 'sentry/utils/usePrevious';

export function useInteractionViewCheckPoint({
  view,
  lastInteraction,
}: {
  lastInteraction: 'pan' | 'click' | 'zoom' | 'scroll' | 'select' | 'resize' | null;
  view: CanvasView<any> | null;
}) {
  const previousInteraction = usePrevious(lastInteraction);
  const beforeInteractionConfigView = useRef<Rect | null>(null);

  const dispatch = useDispatchFlamegraphState();

  useEffect(() => {
    if (!view) {
      return;
    }

    // Check if we are starting a new interaction
    if (previousInteraction === null && lastInteraction) {
      beforeInteractionConfigView.current = view.configView.clone();
      return;
    }

    if (
      beforeInteractionConfigView.current &&
      !beforeInteractionConfigView.current.equals(view.configView)
    ) {
      dispatch({type: 'checkpoint', payload: view.configView.clone()});
    }
  }, [dispatch, lastInteraction, previousInteraction, view]);
}
