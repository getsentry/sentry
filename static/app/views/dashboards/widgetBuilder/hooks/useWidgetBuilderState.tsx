import {useCallback, useMemo} from 'react';
import {DisplayType} from 'sentry/views/dashboards/types';

import {useQueryParamState} from 'sentry/views/dashboards/widgetBuilder/hooks/useQueryParamState';

export const BuilderStateAction = {
  SET_TITLE: 'SET_TITLE',
  SET_DESCRIPTION: 'SET_DESCRIPTION',
  SET_DISPLAY_TYPE: 'SET_DISPLAY_TYPE',
} as const;

type WidgetAction =
  | {payload: string; type: typeof BuilderStateAction.SET_TITLE}
  | {payload: string; type: typeof BuilderStateAction.SET_DESCRIPTION}
  | {payload: DisplayType; type: typeof BuilderStateAction.SET_DISPLAY_TYPE};

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
  const [displayType, setDisplayType] = useQueryParamState('displayType');

  const state = useMemo(
    () => ({title, description, displayType}),
    [title, description, displayType]
  );

  const dispatch = useCallback(
    (action: WidgetAction) => {
      switch (action.type) {
        case BuilderStateAction.SET_TITLE:
          setTitle(action.payload);
          break;
        case BuilderStateAction.SET_DESCRIPTION:
          setDescription(action.payload);
          break;
        case BuilderStateAction.SET_DISPLAY_TYPE:
          setDisplayType(action.payload);
          break;
        default:
          break;
      }
    },
    [setTitle, setDescription, setDisplayType]
  );

  return {
    state,
    dispatch,
  };
}

export default useWidgetBuilderState;
