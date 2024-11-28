import {useCallback, useMemo} from 'react';

import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {useQueryParamState} from 'sentry/views/dashboards/widgetBuilder/hooks/useQueryParamState';

export const BuilderStateAction = {
  SET_TITLE: 'SET_TITLE',
  SET_DESCRIPTION: 'SET_DESCRIPTION',
  SET_DISPLAY_TYPE: 'SET_DISPLAY_TYPE',
  SET_DATASET: 'SET_DATASET',
} as const;

type WidgetAction =
  | {payload: string; type: typeof BuilderStateAction.SET_TITLE}
  | {payload: string; type: typeof BuilderStateAction.SET_DESCRIPTION}
  | {payload: DisplayType; type: typeof BuilderStateAction.SET_DISPLAY_TYPE}
  | {payload: WidgetType; type: typeof BuilderStateAction.SET_DATASET};

interface WidgetBuilderState {
  dataset?: WidgetType;
  description?: string;
  displayType?: DisplayType;
  title?: string;
}

function useWidgetBuilderState(): {
  dispatch: (action: WidgetAction) => void;
  state: WidgetBuilderState;
} {
  const [title, setTitle] = useQueryParamState<string>({fieldName: 'title'});
  const [description, setDescription] = useQueryParamState<string>({
    fieldName: 'description',
  });
  const [displayType, setDisplayType] = useQueryParamState<DisplayType>({
    fieldName: 'displayType',
    decoder: decodeDisplayType,
  });
  const [dataset, setDataset] = useQueryParamState<WidgetType>({
    fieldName: 'dataset',
    decoder: decodeDataset,
  });

  const state = useMemo(
    () => ({title, description, displayType, dataset}),
    [title, description, displayType, dataset]
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
        case BuilderStateAction.SET_DATASET:
          setDataset(action.payload);
          break;
        default:
          break;
      }
    },
    [setTitle, setDescription, setDisplayType, setDataset]
  );

  return {
    state,
    dispatch,
  };
}

/**
 * Decodes the display type from the query params
 * Returns the default display type if the value is not a valid display type
 */
function decodeDisplayType(value: string): DisplayType {
  if (Object.values(DisplayType).includes(value as DisplayType)) {
    return value as DisplayType;
  }
  return DisplayType.TABLE;
}

/**
 * Decodes the dataset from the query params
 * Returns the default dataset if the value is not a valid dataset
 */
function decodeDataset(value: string): WidgetType {
  if (Object.values(WidgetType).includes(value as WidgetType)) {
    return value as WidgetType;
  }
  return WidgetType.ERRORS;
}

export default useWidgetBuilderState;
