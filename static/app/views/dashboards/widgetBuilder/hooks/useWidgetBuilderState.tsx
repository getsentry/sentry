import {useCallback, useMemo} from 'react';

import {useQueryParamState} from 'sentry/views/dashboards/widgetBuilder/hooks/useQueryParamState';

export const BuilderStateAction = {
  SET_TITLE: 'SET_TITLE',
  SET_DESCRIPTION: 'SET_DESCRIPTION',
} as const;

type WidgetAction =
  | {payload: string; type: typeof BuilderStateAction.SET_TITLE}
  | {payload: string; type: typeof BuilderStateAction.SET_DESCRIPTION};

interface WidgetBuilderState {
  description?: string;
  title?: string;
}

function useWidgetBuilderState(): {
  dispatch: (action: WidgetAction) => void;
  state: WidgetBuilderState;
} {
  const [title, setTitle] = useQueryParamState('title');
  const [description, setDescription] = useQueryParamState('description');

  const state = useMemo(() => ({title, description}), [title, description]);

  const dispatch = useCallback(
    (action: WidgetAction) => {
      switch (action.type) {
        case BuilderStateAction.SET_TITLE:
          setTitle(action.payload);
          break;
        case BuilderStateAction.SET_DESCRIPTION:
          setDescription(action.payload);
          break;
        default:
          break;
      }
    },
    [setTitle, setDescription]
  );

  return {
    state,
    dispatch,
  };
}

export default useWidgetBuilderState;
