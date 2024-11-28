import {useCallback, useMemo} from 'react';

import {useTitle} from 'sentry/views/dashboards/widgetBuilder/hooks/useTitle';

export const BuilderStateAction = {
  SET_TITLE: 'SET_TITLE',
} as const;

type WidgetAction = {payload: string; type: typeof BuilderStateAction.SET_TITLE};

interface WidgetBuilderState {
  title?: string;
}

function useWidgetBuilderState(): {
  dispatch: (action: WidgetAction) => void;
  state: WidgetBuilderState;
} {
  const [title, setTitle] = useTitle();

  const state = useMemo(() => ({title}), [title]);

  const dispatch = useCallback(
    (action: WidgetAction) => {
      switch (action.type) {
        case BuilderStateAction.SET_TITLE:
          setTitle(action.payload);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
    },
    [setTitle]
  );

  return {
    state,
    dispatch,
  };
}

export default useWidgetBuilderState;
