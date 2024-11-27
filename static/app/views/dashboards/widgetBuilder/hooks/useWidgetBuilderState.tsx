import {useReducer, useCallback} from 'react';
import {useQueryParamState} from 'sentry/views/dashboards/widgetBuilder/hooks/useQueryParamState';

export const BuilderStateAction = {
  SET_TITLE: 'SET_TITLE',
  SET_DESCRIPTION: 'SET_DESCRIPTION',
} as const;

type WidgetAction =
  | {payload: string; type: typeof BuilderStateAction.SET_TITLE}
  | {payload: string; type: typeof BuilderStateAction.SET_DESCRIPTION};

interface WidgetBuilderState {
  title?: string;
  description?: string;
}

function useWidgetBuilderState(): {
  dispatch: (action: WidgetAction) => void;
  state: WidgetBuilderState;
} {
  const [title, setTitle] = useQueryParamState('title');
  const [description, setDescription] = useQueryParamState('description');

  const reducer = useCallback(
    (state: WidgetBuilderState, action: WidgetAction): WidgetBuilderState => {
      switch (action.type) {
        case BuilderStateAction.SET_TITLE:
          setTitle(action.payload);
          return {...state, title: action.payload};
        case BuilderStateAction.SET_DESCRIPTION:
          setDescription(action.payload);
          return {...state, description: action.payload};
        default:
          return state;
      }
    },
    []
  );

  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    title,
    description,
  }));

  return {
    state,
    dispatch,
  };
}

export default useWidgetBuilderState;
